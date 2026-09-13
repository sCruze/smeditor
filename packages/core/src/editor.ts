/**
 * Editor instance — the heart of @smeditor/core.
 *
 * Responsibilities:
 *   - Compile the schema from extensions
 *   - Hold the canonical document (JSON) and selection state
 *   - Run transactions and update the DOM if mounted
 *   - Wire commands and keyboard shortcuts contributed by extensions
 *   - Sync the DOM-side `contenteditable` selection into our internal model
 *   - Emit lifecycle events
 *
 * The mounted view uses native contenteditable. We treat the DOM as a
 * render target and rebuild it from the JSON document on each update.
 * This is simple and correct; performance optimizations (diff-patching)
 * are a future task.
 */

import type {
  CompiledSchema,
  DocumentJSON,
  DocumentNode,
  EditorEventName,
  EditorEventPayload,
  EditorInstance,
  EditorOptions,
  EditorSelection,
  Extension,
  Transaction,
  SelectionPoint,
} from "./types.js";
import { compileSchema, flattenExtensions } from "./schema.js";
import { serializeToHTML, parseHTML } from "./serializer.js";
import { History } from "./history.js";
import { EventEmitter } from "./events.js";
import {
  cloneDoc,
  docsEqual,
  emptyDocument,
  getBlockText,
  selectionHasMark,
} from "./doc-utils.js";
import { nodeAt, normalizeDeepPoint } from "./path.js";
import {
  hardenLinkAttrs,
  sanitizeCSSColor,
  sanitizeCSSFontFamily,
  sanitizeCSSFontSize,
  sanitizeCSSLineHeight,
  sanitizeCSSTextStrokeWidth,
  sanitizeLinkTarget,
  sanitizeURL,
} from "./css.js";

/** Public entry point used by `@smeditor/react` and standalone users. */
export function createEditor(options: EditorOptions): EditorInstance {
  return new Editor(options);
}

class Editor implements EditorInstance {
  public readonly options: EditorOptions;
  public element: HTMLElement | null;
  public readonly extensions: Extension[];
  public readonly schema: CompiledSchema;
  public readonly commands: Record<string, (...args: any[]) => boolean>;

  private doc: DocumentJSON;
  private selection: EditorSelection | null = null;
  private readonly history = new History();
  private readonly emitter = new EventEmitter();
  private destroyed = false;
  private updatingDOM = false;
  /**
   * True while an IME composition is in progress (CJK input, dead keys,
   * accent menus). The browser fires intermediate `input` events during
   * composition whose DOM we must NOT reparse/rebuild — doing so tears
   * down the composition mid-keystroke. We wait for `compositionend`.
   */
  private composing = false;

  // Bound listeners (kept so we can remove them on destroy)
  private readonly onDomInput = () => this.handleDOMInput();
  private readonly onDomBeforeInput = (e: Event) =>
    this.handleBeforeInput(e as InputEvent);
  private readonly onDomPaste = (e: ClipboardEvent) => this.handlePaste(e);
  private readonly onDomKeydown = (e: KeyboardEvent) =>
    this.handleKeydown(e);
  private readonly onDomFocus = () =>
    this.emit("focus", { editor: this });
  private readonly onDomBlur = () =>
    this.emit("blur", { editor: this });
  private readonly onSelectionChange = () => this.syncSelectionFromDOM();
  private readonly selectionChangeTargets: EventTarget[] = [];
  private readonly onCompositionStart = () => {
    this.composing = true;
  };
  private readonly onCompositionEnd = () => {
    this.composing = false;
    // Capture the finished composed text in one shot.
    this.handleDOMInput();
  };

  constructor(options: EditorOptions) {
    this.options = {
      ...options,
      theme: options.theme ?? "light",
    };
    this.element = options.element ?? null;

    // 1. Resolve extensions
    this.extensions = flattenExtensions(options.extensions ?? []);

    // 2. Compile schema
    this.schema = compileSchema(this.extensions);

    // 3. Normalize initial content into JSON
    this.doc = this.normalizeContent(options.content);

    // 4. Wire commands
    this.commands = this.buildCommandMap();

    // 5. Lifecycle: onCreate for each extension
    for (const ext of this.extensions) {
      ext.onCreate?.(this);
    }

    // 6. Mount to DOM if an element was given
    if (this.element) {
      this.attachToElement();
    }

    // 7. Fire onCreate
    queueMicrotask(() => {
      if (this.destroyed) return;
      this.emit("create", { editor: this });
      this.options.onCreate?.({ editor: this });
      if (options.autofocus) this.focus();
    });
  }

  // ==========================================================================
  // Content
  // ==========================================================================

  getJSON(): DocumentJSON {
    return cloneDoc(this.doc);
  }

  getHTML(): string {
    return serializeToHTML(this.doc, this.schema);
  }

  setContent(content: string | DocumentJSON): void {
    const next = this.normalizeContent(content);
    this.dispatch({
      doc: next,
      selection: null,
      addToHistory: true,
    });
  }

  private normalizeContent(
    content: EditorOptions["content"],
  ): DocumentJSON {
    if (!content) return emptyDocument();
    if (typeof content === "string") {
      return parseHTML(content, this.schema);
    }
    if (content.type === "doc" && Array.isArray(content.content)) {
      return cloneDoc(content);
    }
    return emptyDocument();
  }

  // ==========================================================================
  // Selection
  // ==========================================================================

  getSelection(): EditorSelection | null {
    return this.selection ? cloneDoc(this.selection) : null;
  }

  setSelection(selection: EditorSelection): void {
    this.dispatch({ selection });
  }

  /**
   * The pixel coordinates of a selection point, relative to the
   * editor element's top-left corner. Used to position overlays such
   * as remote collaborator cursors. Returns null if the point can't
   * be resolved or the editor isn't mounted.
   */
  coordsAtPoint(
    point: SelectionPoint,
  ): { top: number; left: number; height: number } | null {
    if (!this.element) return null;
    const deep = this.options.deepSelection ?? false;
    const loc = domNodeFromPoint(point, this.element, deep);
    if (!loc) return null;
    try {
      const range = this.element.ownerDocument.createRange();
      const offset = Math.min(loc.offset, lengthOf(loc.node));
      range.setStart(loc.node, offset);
      range.collapse(true);
      const rect = range.getBoundingClientRect();
      const host = this.element.getBoundingClientRect();
      return {
        top: rect.top - host.top,
        left: rect.left - host.left,
        height: rect.height || 16,
      };
    } catch {
      return null;
    }
  }

  // ==========================================================================
  // Transactions
  // ==========================================================================

  dispatch(tr: Transaction): void {
    if (this.destroyed) return;

    const prevDoc = this.doc;
    const prevSelection = this.selection;

    let docChanged = false;
    if (tr.doc && !docsEqual(tr.doc, this.doc)) {
      if (tr.addToHistory !== false) {
        const coalesce =
          typeof tr.meta?.coalesce === "string" ? tr.meta.coalesce : undefined;
        this.history.record(
          {
            doc: cloneDoc(prevDoc),
            selection: prevSelection ? cloneDoc(prevSelection) : null,
          },
          coalesce,
        );
      }
      this.doc = tr.doc;
      docChanged = true;
    }

    let selectionChanged = false;
    if (tr.selection !== undefined) {
      let nextSelection = tr.selection;
      if (nextSelection && (this.options.deepSelection ?? false)) {
        const selectionDoc = tr.doc ?? this.doc;
        nextSelection = {
          anchor: normalizeDeepPoint(selectionDoc, nextSelection.anchor),
          head: normalizeDeepPoint(selectionDoc, nextSelection.head),
        };
      }
      if (!selectionsEqual(nextSelection, this.selection)) {
        this.selection = nextSelection;
        selectionChanged = true;
      }
    }

    this.emit("transaction", { editor: this, transaction: tr });
    this.options.onTransaction?.({ editor: this });

    if (docChanged) {
      this.renderToDOM();
      const html = this.getHTML();
      const json = this.getJSON();
      this.emit("update", { editor: this, html, json });
      this.options.onUpdate?.({ editor: this, html, json });
    }

    if (selectionChanged) {
      // A selection-only change must still move the live DOM caret.
      // renderToDOM (which restores the caret via applySelectionToDOM)
      // only runs when the document changed, so without this an
      // `editor.setSelection(...)` updated the model but left the
      // browser caret — and the next typed character — in the old spot.
      if (!docChanged && this.element) {
        this.updatingDOM = true;
        try {
          this.applySelectionToDOM();
        } finally {
          this.updatingDOM = false;
        }
      }
      this.emit("selectionUpdate", {
        editor: this,
        selection: this.selection ? cloneDoc(this.selection) : null,
      });
      this.options.onSelectionUpdate?.({
        editor: this,
        selection: this.selection ? cloneDoc(this.selection) : null,
      });
    }
  }

  // ==========================================================================
  // Commands
  // ==========================================================================

  private buildCommandMap(): Record<string, (...args: any[]) => boolean> {
    const map: Record<string, (...args: any[]) => boolean> = {};

    // Built-in commands always available
    map.setContent = (content: string | DocumentJSON) => {
      this.setContent(content);
      return true;
    };
    map.clearContent = () => {
      this.dispatch({
        doc: emptyDocument(),
        selection: null,
        addToHistory: true,
      });
      return true;
    };
    map.focus = () => {
      this.focus();
      return true;
    };
    map.blur = () => {
      this.blur();
      return true;
    };
    map.undo = () => {
      const entry = this.history.undo({
        doc: cloneDoc(this.doc),
        selection: this.selection ? cloneDoc(this.selection) : null,
      });
      if (!entry) return false;
      this.dispatch({
        doc: entry.doc,
        selection: entry.selection,
        addToHistory: false,
      });
      return true;
    };
    map.redo = () => {
      const entry = this.history.redo({
        doc: cloneDoc(this.doc),
        selection: this.selection ? cloneDoc(this.selection) : null,
      });
      if (!entry) return false;
      this.dispatch({
        doc: entry.doc,
        selection: entry.selection,
        addToHistory: false,
      });
      return true;
    };

    // Extension-provided commands
    for (const ext of this.extensions) {
      if (!ext.commands) continue;
      for (const [name, factory] of Object.entries(ext.commands)) {
        if (map[name]) {
          // Earlier registration wins to keep core commands stable.
          continue;
        }
        map[name] = (...args: unknown[]) => {
          const cmd = factory(...args);
          if (typeof cmd !== "function") return false;
          return cmd(this);
        };
      }
    }

    return map;
  }

  isActive(name: string, attrs?: Record<string, unknown>): boolean {
    // Mark active check
    if (this.schema.marks[name]) {
      return selectionHasMark(this.doc, this.selection, name, attrs);
    }
    // Block-type check. With the deep selection model the anchor path
    // reaches down into tables / lists / blockquotes, so we walk every
    // node along that path: `isActive("table")` is true when the caret
    // sits in any cell, and `isActive("paragraph")` is true for the
    // leaf the caret is actually in. Indexing `path[0]` only ever saw
    // the top level and reported the wrong type inside containers.
    if (this.schema.nodes[name]) {
      const sel = this.selection;
      if (!sel) return false;
      let node: DocumentNode = this.doc;
      const chain: DocumentNode[] = [];
      for (const idx of sel.anchor.path) {
        const child = node.content?.[idx];
        if (!child) break;
        chain.push(child);
        node = child;
      }
      for (const block of chain) {
        if (block.type !== name) continue;
        if (!attrs) return true;
        let allMatch = true;
        for (const [k, v] of Object.entries(attrs)) {
          if (block.attrs?.[k] !== v) {
            allMatch = false;
            break;
          }
        }
        if (allMatch) return true;
      }
      return false;
    }
    return false;
  }

  // ==========================================================================
  // DOM mount
  // ==========================================================================

  /**
   * Public mount. Useful in framework integrations where the host
   * element only becomes available inside an effect / mounted hook.
   * Safe to call only once; subsequent calls are ignored.
   */
  mount(element: HTMLElement): void {
    if (this.element || this.destroyed) return;
    this.element = element;
    this.attachToElement();
  }

  private attachToElement(): void {
    const el = this.element!;
    el.setAttribute("contenteditable", String(this.options.editable !== false));
    el.setAttribute("data-theme", this.options.theme ?? "light");
    el.classList.add("smeditor-editor");
    el.addEventListener("input", this.onDomInput);
    el.addEventListener("beforeinput", this.onDomBeforeInput);
    el.addEventListener("paste", this.onDomPaste);
    el.addEventListener("keydown", this.onDomKeydown);
    el.addEventListener("focus", this.onDomFocus);
    el.addEventListener("blur", this.onDomBlur);
    el.addEventListener("compositionstart", this.onCompositionStart);
    el.addEventListener("compositionend", this.onCompositionEnd);

    if (typeof document !== "undefined") {
      // Keep the model selection in sync in both regular DOM and Shadow DOM.
      // Chromium exposes the live shadow selection on ShadowRoot; listening to
      // that root as well as Document avoids missing drag-selection events.
      const root = el.getRootNode?.();
      const targets: EventTarget[] = [document];
      if (root && root !== document && "addEventListener" in root) targets.push(root);
      for (const target of targets) {
        target.addEventListener("selectionchange", this.onSelectionChange);
        this.selectionChangeTargets.push(target);
      }
    }

    this.renderToDOM();
  }

  focus(): void {
    if (this.destroyed) return;
    this.element?.focus();
  }

  blur(): void {
    if (this.destroyed) return;
    this.element?.blur();
  }

  isEditable(): boolean {
    const attr = this.element?.getAttribute("contenteditable");
    if (attr === "false") return false;
    if (attr === "true") return true;
    return this.options.editable !== false;
  }

  canUndo(): boolean {
    return this.history.canUndo();
  }

  canRedo(): boolean {
    return this.history.canRedo();
  }

  /**
   * Render the document to the contenteditable element.
   * Caret position is preserved by snapshotting the DOM selection
   * before the rewrite and restoring it after (best-effort).
   */
  private renderToDOM(): void {
    if (!this.element) return;
    this.updatingDOM = true;
    try {
      const html = this.getHTML();
      // Don't clobber if identical — avoids losing caret on no-op updates.
      if (this.element.innerHTML !== html) {
        this.element.innerHTML = html || "<p><br/></p>";
      }
      // Restore caret from internal selection model
      this.applySelectionToDOM();
    } finally {
      this.updatingDOM = false;
    }
  }

  /**
   * Read the contenteditable HTML back into our JSON model after user input.
   * This is the round-trip that makes typing work.
   */
  /**
   * Intercept input before it reaches the DOM. Typed text and
   * deletes are offered to extension hooks (track changes uses these
   * to mark edits); if a hook handles the event, the native input is
   * suppressed.
   */
  private handleBeforeInput(e: InputEvent): void {
    if (this.updatingDOM || !this.element) return;
    // Let the browser drive IME composition; we reconcile on compositionend.
    if (this.composing || e.isComposing) return;
    const type = e.inputType;
    if (type === "insertText" && typeof e.data === "string") {
      for (const ext of this.extensions) {
        if (ext.handleTextInput?.(this, e.data)) {
          e.preventDefault();
          return;
        }
      }
    } else if (
      type === "deleteContentBackward" ||
      type === "deleteContentForward"
    ) {
      const direction =
        type === "deleteContentBackward" ? "backward" : "forward";
      for (const ext of this.extensions) {
        if (ext.handleDeleteContent?.(this, direction)) {
          e.preventDefault();
          return;
        }
      }
    }
  }

  private handleDOMInput(): void {
    if (this.updatingDOM || !this.element) return;
    // Mid-composition DOM is incomplete; reconcile on compositionend.
    if (this.composing) return;
    const html = this.element.innerHTML;
    const nextDoc = parseHTML(html, this.schema);
    if (docsEqual(nextDoc, this.doc)) return;
    // Read the DOM selection while it's still fresh
    const sel = this.readSelectionFromDOM();
    this.dispatch({
      doc: nextDoc,
      selection: sel,
      addToHistory: true,
      // Coalesce a run of typing in one block into a single undo step.
      meta: { coalesce: "input:" + (sel ? sel.anchor.path.join(",") : "") },
    });
    // After the document reflects what the user typed, give input
    // rules a chance to fire (e.g. "## " → heading). Rules run against
    // the freshly-updated doc; a rule that matches dispatches its own
    // follow-up transaction.
    this.applyInputRules();
  }

  /**
   * Test every extension's input rules against the text immediately
   * before the caret in the current block. The first rule whose regex
   * matches gets to run its handler; if the handler returns true we
   * stop (one rule per input event).
   *
   * Input rules are how typed-text shortcuts work — markdown patterns
   * (`# `, `> `, `1. `) and similar. The regex is matched against the
   * block text up to the caret offset, so `match[0]` is the typed
   * prefix the handler will usually want to strip.
   */
  private applyInputRules(): void {
    if (this.destroyed || !this.selection) return;
    const block = nodeAt(this.doc, this.selection.anchor.path);
    if (!block) return;

    const offset = this.selection.anchor.offset;
    const fullText = getBlockText(block);
    // Guard: offset can momentarily exceed text length during fast
    // typing — clamp so slice() behaves.
    const textBefore = fullText.slice(
      0,
      Math.max(0, Math.min(offset, fullText.length)),
    );
    if (!textBefore) return;

    for (const ext of this.extensions) {
      if (!ext.inputRules) continue;
      for (const rule of ext.inputRules) {
        // Reset lastIndex so a stateful (/g) regex doesn't skip matches.
        if (rule.match.global || rule.match.sticky) rule.match.lastIndex = 0;
        const m = rule.match.exec(textBefore);
        if (!m) continue;
        const handled = rule.handler(this, m);
        if (handled) return;
      }
    }
  }

  /**
   * Intercept paste, sanitize the pasted HTML, and insert the cleaned
   * version. This is the §12 "paste cleanup" — pasting from Word /
   * Google Docs otherwise drags in `mso-*` styles, empty `<span>`s,
   * `<o:p>` tags and other noise.
   *
   * Plain-text pastes (no `text/html` payload) are left to the browser.
   */
  private handlePaste(e: ClipboardEvent): void {
    if (this.updatingDOM || !this.element) return;
    if (this.element.getAttribute("contenteditable") === "false") return;
    const data = e.clipboardData;
    if (!data) return;
    const html = data.getData("text/html");
    if (!html) return; // plain text — browser default is fine

    e.preventDefault();
    let cleaned = sanitizePastedHTML(html);
    // Let extensions apply source-specific cleanup on top of the
    // built-in sanitizer. A faulty transformer is skipped, not fatal.
    for (const ext of this.extensions) {
      if (typeof ext.transformPastedHTML === "function") {
        try {
          cleaned = ext.transformPastedHTML(cleaned);
        } catch {
          /* ignore — keep the previous HTML */
        }
      }
    }
    if (typeof document === "undefined") return;

    // execCommand is deprecated but still the most reliable way to
    // insert HTML at the caret across browsers. The resulting `input`
    // event flows through handleDOMInput like any other edit.
    try {
      document.execCommand("insertHTML", false, cleaned);
    } catch {
      // If insertHTML isn't available, fall back to plain text so the
      // paste at least lands somewhere.
      const text = data.getData("text/plain");
      if (text) document.execCommand("insertText", false, text);
    }
    // Some browsers don't emit `input` for execCommand — nudge the
    // round-trip so the JSON model stays in sync.
    queueMicrotask(() => {
      if (!this.destroyed) this.handleDOMInput();
    });
  }

  private handleKeydown(e: KeyboardEvent): void {
    // Convert event into a "Mod-key" string
    const combo = comboFromEvent(e);
    for (const ext of this.extensions) {
      if (!ext.keyboardShortcuts) continue;
      const handler = ext.keyboardShortcuts[combo];
      if (handler) {
        const handled = handler(this);
        if (handled) {
          e.preventDefault();
          return;
        }
      }
    }
    // Built-in shortcuts: Ctrl/Cmd-Z, Ctrl/Cmd-Shift-Z / Ctrl-Y
    if (combo === "Mod-z") {
      if (this.commands.undo?.()) e.preventDefault();
    } else if (combo === "Mod-Shift-z" || combo === "Mod-y") {
      if (this.commands.redo?.()) e.preventDefault();
    }
  }

  // ==========================================================================
  // Selection sync
  // ==========================================================================

  private syncSelectionFromDOM(): void {
    if (this.updatingDOM || !this.element) return;
    const domSel = selectionForElement(this.element);
    if (!domSel) return;
    if (!this.element.contains(domSel.anchorNode)) return;
    const next = this.readSelectionFromDOM();
    if (!next) return;
    if (selectionsEqual(next, this.selection)) return;
    this.selection = next;
    this.emit("selectionUpdate", {
      editor: this,
      selection: cloneDoc(next),
    });
    this.options.onSelectionUpdate?.({
      editor: this,
      selection: cloneDoc(next),
    });
  }

  private readSelectionFromDOM(): EditorSelection | null {
    if (!this.element) return null;
    const sel = selectionForElement(this.element);
    if (!sel || sel.rangeCount === 0) return null;
    const deep = this.options.deepSelection ?? false;
    const anchor = pointFromDOM(
      sel.anchorNode,
      sel.anchorOffset,
      this.element,
      deep,
    );
    const head = pointFromDOM(
      sel.focusNode,
      sel.focusOffset,
      this.element,
      deep,
    );
    if (!anchor || !head) return null;
    // In deep mode, a point that resolved to a container (a click on
    // table structure rather than text) is pulled down to a leaf.
    if (deep) {
      const doc = this.getJSON();
      return {
        anchor: normalizeDeepPoint(doc, anchor),
        head: normalizeDeepPoint(doc, head),
      };
    }
    return { anchor, head };
  }

  private applySelectionToDOM(): void {
    if (!this.selection || !this.element) {
      return;
    }
    const sel = selectionForElement(this.element);
    if (!sel) return;
    const deep = this.options.deepSelection ?? false;
    const anchorNode = domNodeFromPoint(
      this.selection.anchor,
      this.element,
      deep,
    );
    const headNode = domNodeFromPoint(this.selection.head, this.element, deep);
    if (!anchorNode || !headNode) return;
    try {
      const range = this.element.ownerDocument.createRange();
      range.setStart(
        anchorNode.node,
        Math.min(anchorNode.offset, lengthOf(anchorNode.node)),
      );
      range.setEnd(
        headNode.node,
        Math.min(headNode.offset, lengthOf(headNode.node)),
      );
      sel.removeAllRanges();
      sel.addRange(range);
    } catch {
      // Selection restore is best-effort.
    }
  }

  // ==========================================================================
  // Events
  // ==========================================================================

  on<E extends EditorEventName>(
    event: E,
    handler: (payload: EditorEventPayload[E]) => void,
  ): () => void {
    return this.emitter.on(event, handler);
  }

  private emit<E extends EditorEventName>(
    event: E,
    payload: EditorEventPayload[E],
  ): void {
    this.emitter.emit(event, payload);
  }

  // ==========================================================================
  // Destroy
  // ==========================================================================

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.element) {
      this.element.removeEventListener("input", this.onDomInput);
      this.element.removeEventListener("beforeinput", this.onDomBeforeInput);
      this.element.removeEventListener("paste", this.onDomPaste);
      this.element.removeEventListener("keydown", this.onDomKeydown);
      this.element.removeEventListener("focus", this.onDomFocus);
      this.element.removeEventListener("blur", this.onDomBlur);
      this.element.removeEventListener(
        "compositionstart",
        this.onCompositionStart,
      );
      this.element.removeEventListener("compositionend", this.onCompositionEnd);
    }
    for (const target of this.selectionChangeTargets) {
      target.removeEventListener("selectionchange", this.onSelectionChange);
    }
    this.selectionChangeTargets.length = 0;
    for (const ext of this.extensions) {
      ext.onDestroy?.(this);
    }
    this.emit("destroy", { editor: this });
    this.options.onDestroy?.({ editor: this });
    this.emitter.clear();
  }
}

// ============================================================================
// Helpers (module-private)
// ============================================================================

/**
 * Return the Selection object that actually owns the editor caret.
 *
 * `document.getSelection()` is not sufficient for editors mounted inside an
 * open ShadowRoot: Chromium exposes a composed selection on the document whose
 * anchor can be the shadow host instead of the text node inside the editor.
 * Reading that selection produces a null/wrong editor position; the next DOM
 * render then loses the caret (most visibly when typing spaces).
 *
 * Both Document and Chromium's ShadowRoot expose getSelection(). Prefer the
 * editor's root and fall back to its owner document for browsers that do not
 * expose ShadowRoot#getSelection.
 */
function selectionForElement(element: HTMLElement): Selection | null {
  const root = element.getRootNode?.();
  const rootedGetSelection = (root as {
    getSelection?: () => Selection | null;
  } | null)?.getSelection;

  if (root && typeof rootedGetSelection === "function") {
    const selection = rootedGetSelection.call(root);
    if (selection) return selection;
  }

  return element.ownerDocument?.getSelection?.() ?? null;
}

/**
 * Strip noise and unsafe elements from pasted HTML.
 *
 * Removes script/style/meta/link/head/title and Office namespace tags
 * (`<o:p>`, `<xml>`, …), drops HTML comments, and prunes attributes
 * down to a safe whitelist. Inline `style` is reduced to just the
 * declarations SMEditor understands — text-align, color,
 * background-color — so Word's `mso-*` and font-family clutter is
 * dropped while genuine formatting survives.
 */
function sanitizePastedHTML(html: string): string {
  if (typeof DOMParser === "undefined") {
    return html.replace(/<[^>]*>/g, "");
  }
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const body = parsed.body;
  if (!body) return "";

  // Drop dangerous / useless elements outright.
  body
    .querySelectorAll(
      "script,style,meta,link,title,head,o\\:p,v\\:shape,w\\:sdt,xml,iframe,object,embed,svg,math",
    )
    .forEach((n) => n.remove());

  // Drop HTML comments (Word emits conditional comments everywhere).
  const walker = parsed.createTreeWalker(body, NodeFilter.SHOW_COMMENT);
  const comments: Node[] = [];
  let c: Node | null;
  while ((c = walker.nextNode())) comments.push(c);
  comments.forEach((n) => n.parentNode?.removeChild(n));

  // Word renders list bullets as <span style="mso-list:Ignore">•</span>.
  // Remove them before the style attribute is pruned away, so the
  // bullet glyph doesn't bleed into the text.
  body.querySelectorAll("span").forEach((span) => {
    const style = span.getAttribute("style") ?? "";
    if (/mso-list\s*:\s*ignore/i.test(style)) span.remove();
  });

  body.querySelectorAll("*").forEach((el) => sanitizePastedElement(el));

  // Unwrap spans left with no attributes — Word nests these many deep.
  // Repeat until stable, since unwrapping exposes more empty spans.
  for (let pass = 0; pass < 5; pass++) {
    const empties = Array.from(body.querySelectorAll("span")).filter(
      (s) => s.attributes.length === 0,
    );
    if (empties.length === 0) break;
    for (const span of empties) {
      while (span.firstChild) {
        span.parentNode?.insertBefore(span.firstChild, span);
      }
      span.remove();
    }
  }

  // Remove block elements left visually empty (Word emits stray <p>s).
  body.querySelectorAll("p,div").forEach((el) => {
    const text = (el.textContent ?? "").replace(/\u00a0/g, " ").trim();
    if (!text && el.children.length === 0) el.remove();
  });

  return body.innerHTML;
}

function sanitizePastedElement(el: Element): void {
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase();
    const value = attr.value;

    if (name === "style") {
      const style = sanitizePastedStyle(value);
      if (style) el.setAttribute("style", style);
      else el.removeAttribute(attr.name);
    } else if (name === "href") {
      const href = sanitizeURL(value, {
        protocols: ["http", "https", "mailto", "tel"],
        allowBareEmail: true,
      });
      if (href) el.setAttribute("href", href);
      else el.removeAttribute(attr.name);
    } else if (name === "src") {
      const src = sanitizeURL(value, {
        protocols: ["http", "https"],
        allowFragments: false,
        allowDataUrls: true,
        dataUrlPattern: /^data:image\/(?:png|jpe?g|gif|webp|avif|bmp);base64,[a-z0-9+/=\s]+$/i,
      });
      if (src) el.setAttribute("src", src);
      else el.removeAttribute(attr.name);
    } else if (name === "target") {
      const target = sanitizeLinkTarget(value);
      if (target) el.setAttribute("target", target);
      else el.removeAttribute(attr.name);
    } else if (name === "rel") {
      el.removeAttribute(attr.name);
    } else if (name === "alt" || name === "title") {
      el.setAttribute(name, value.replace(/[\u0000-\u001f\u007f]/g, ""));
    } else if (name === "colspan" || name === "rowspan") {
      const span = sanitizeTableSpan(value);
      if (span) el.setAttribute(name, span);
      else el.removeAttribute(attr.name);
    } else {
      el.removeAttribute(attr.name);
    }
  }

  if (el.tagName.toLowerCase() === "a") {
    const href = el.getAttribute("href");
    if (!href) {
      el.removeAttribute("target");
    } else {
      const attrs: Record<string, string> = { href };
      const target = sanitizeLinkTarget(el.getAttribute("target"));
      if (target) attrs.target = target;
      const hardened = hardenLinkAttrs(attrs);
      if (hardened.rel) el.setAttribute("rel", hardened.rel);
      else el.removeAttribute("rel");
    }
  }
}

function sanitizePastedStyle(style: string): string | null {
  const kept: string[] = [];
  for (const decl of style.split(";")) {
    const match = /^\s*([a-z-]+)\s*:\s*(.+?)\s*$/i.exec(decl);
    if (!match) continue;
    const name = match[1].toLowerCase();
    const value = sanitizePastedStyleValue(name, match[2]);
    if (value) kept.push(`${name}: ${value}`);
  }
  return kept.length > 0 ? kept.join("; ") : null;
}

function sanitizePastedStyleValue(name: string, value: string): string | null {
  if (name === "text-align") return sanitizeTextAlign(value);
  if (name === "color") return sanitizeCSSColor(value);
  if (name === "background-color" || name === "background") {
    return sanitizeCSSColor(value);
  }
  if (name === "font-family") return sanitizeCSSFontFamily(value);
  if (name === "font-size") return sanitizeCSSFontSize(value);
  if (name === "line-height") return sanitizeCSSLineHeight(value);
  if (name === "-webkit-text-stroke" || name === "text-stroke") {
    return sanitizeTextStroke(value);
  }
  if (
    name === "-webkit-text-stroke-color" ||
    name === "text-stroke-color"
  ) {
    return sanitizeCSSColor(value);
  }
  if (
    name === "-webkit-text-stroke-width" ||
    name === "text-stroke-width"
  ) {
    return sanitizeCSSTextStrokeWidth(value);
  }
  return null;
}

function sanitizeTextAlign(value: string): string | null {
  const align = value.trim().toLowerCase();
  return ["left", "center", "right", "justify"].includes(align) ? align : null;
}

function sanitizeTextStroke(value: string): string | null {
  const match = /^\s*([^\s]+)\s+(.+)\s*$/.exec(value.trim());
  if (!match) return null;
  const width = sanitizeCSSTextStrokeWidth(match[1]);
  const color = sanitizeCSSColor(match[2]);
  return width && color ? `${width} ${color}` : null;
}

function sanitizeTableSpan(value: string): string | null {
  const span = Math.round(Number(value));
  return Number.isFinite(span) && span >= 1 && span <= 100 ? String(span) : null;
}

function comboFromEvent(e: KeyboardEvent): string {
  const parts: string[] = [];
  // "Mod" is Cmd on Mac, Ctrl elsewhere — for shortcuts written as "Mod-b"
  if (e.metaKey || e.ctrlKey) parts.push("Mod");
  if (e.shiftKey) parts.push("Shift");
  if (e.altKey) parts.push("Alt");
  let key = e.key;
  // For the digit row, browsers report the SHIFTED symbol in `e.key`
  // when Shift is held (Shift+7 → "&", Shift+8 → "*", Shift+9 → "("),
  // so a shortcut registered as "Mod-Shift-7" would never match. Derive
  // the digit from the layout-independent physical code instead.
  if (/^Digit[0-9]$/.test(e.code)) key = e.code.slice(5);
  else if (key.length === 1) key = key.toLowerCase();
  parts.push(key);
  return parts.join("-");
}

function selectionsEqual(
  a: EditorSelection | null,
  b: EditorSelection | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    pointsEqual(a.anchor, b.anchor) && pointsEqual(a.head, b.head)
  );
}

function pointsEqual(a: SelectionPoint, b: SelectionPoint): boolean {
  if (a.offset !== b.offset) return false;
  if (a.path.length !== b.path.length) return false;
  return a.path.every((v, i) => v === b.path[i]);
}

/**
 * Translate a DOM node + offset into our internal SelectionPoint.
 * The path is computed as the chain of childNode indices from the
 * editor root to the parent block; the offset is the character offset
 * within the text content of that block.
 */
/**
 * Tags that correspond to a block-level node in the document tree.
 * The DOM mirrors the JSON tree for these (table → tr → td → p, with
 * no structural wrappers), so walking block elements reconstructs the
 * node path. Mark wrappers (strong, em, a, …) are deliberately
 * absent — they don't add a level to the path.
 */
const BLOCK_TAGS = new Set([
  "p", "h1", "h2", "h3", "h4", "h5", "h6",
  "blockquote", "pre", "hr",
  "ul", "ol", "li",
  "table", "tr", "td", "th",
  "figure",
]);

function isBlockElement(n: Node): boolean {
  return (
    n.nodeType === 1 &&
    BLOCK_TAGS.has((n as Element).tagName.toLowerCase())
  );
}

/**
 * Table section wrappers. The browser auto-inserts a `<tbody>` around
 * `<tr>` rows when innerHTML is assigned, but the JSON model has no
 * such level (table → row → cell). They are transparent: not a path
 * level themselves, but their `<tr>` children are.
 */
const SECTION_TAGS = new Set(["tbody", "thead", "tfoot"]);

/**
 * Block-level element children of `container`, descending through
 * transparent table section wrappers so the DOM table→row→cell→block
 * chain keeps matching the JSON path. Used by both the read
 * (pointFromDOM) and write (domNodeFromPoint) deep-selection paths so
 * they stay symmetric — otherwise the caret restored after a table
 * edit landed on the `<table>` element instead of the cell.
 */
function blockChildrenOf(container: Node): Element[] {
  const out: Element[] = [];
  for (const c of Array.from(container.childNodes)) {
    if (c.nodeType !== 1) continue;
    const tag = (c as Element).tagName.toLowerCase();
    if (SECTION_TAGS.has(tag)) out.push(...blockChildrenOf(c));
    else if (isBlockElement(c)) out.push(c as Element);
  }
  return out;
}

/** Character offset of (node, offset) within `container`. */
function textOffsetWithin(
  container: Node,
  node: Node,
  offset: number,
): number {
  let charOffset = 0;
  const walk = (n: Node): boolean => {
    if (n === node) {
      charOffset += offset;
      return true;
    }
    if (n.nodeType === 3) {
      charOffset += n.textContent?.length ?? 0;
    } else {
      for (const c of Array.from(n.childNodes)) {
        if (walk(c)) return true;
      }
    }
    return false;
  };
  walk(container);
  return charOffset;
}

function pointFromDOM(
  node: Node | null,
  offset: number,
  root: HTMLElement,
  deep = false,
): SelectionPoint | null {
  if (!node) return null;

  if (deep) {
    // Collect the chain of block-element ancestors, root → leaf.
    const chain: Element[] = [];
    let n: Node | null = node;
    while (n && n !== root) {
      if (isBlockElement(n)) chain.unshift(n as Element);
      n = n.parentNode;
    }
    if (chain.length === 0) return null;

    // Each path entry is the element's index among its block siblings.
    const path: number[] = [];
    for (const el of chain) {
      const parent = el.parentNode;
      if (!parent) return null;
      // blockChildrenOf flattens table section wrappers, so a <tr>
      // whose DOM parent is a <tbody> still indexes correctly within
      // its table.
      const blockSiblings = blockChildrenOf(parent);
      const idx = blockSiblings.indexOf(el);
      if (idx < 0) return null;
      path.push(idx);
    }

    // Offset is measured within the leaf block (deepest in the chain).
    const leaf = chain[chain.length - 1];
    return { path, offset: textOffsetWithin(leaf, node, offset) };
  }

  // Top-level mode (default): walk up to the block child of root.
  let cur: Node | null = node;
  let block: Element | null = null;
  while (cur && cur !== root) {
    if (cur.parentNode === root && cur.nodeType === 1) {
      block = cur as Element;
      break;
    }
    cur = cur.parentNode;
  }
  if (!block) return null;
  const blockIndex = Array.from(root.children).indexOf(block);
  if (blockIndex < 0) return null;

  return { path: [blockIndex], offset: textOffsetWithin(block, node, offset) };
}

/**
 * Inverse of pointFromDOM: take a SelectionPoint and find the DOM
 * text-node + offset that corresponds to it.
 */
function domNodeFromPoint(
  point: SelectionPoint,
  root: HTMLElement,
  deep = false,
): { node: Node; offset: number } | null {
  // Resolve the leaf block element the path addresses.
  let block: Element | null = null;
  if (deep) {
    let container: Element = root;
    for (const idx of point.path) {
      const blockChildren = blockChildrenOf(container);
      const next = blockChildren[idx];
      if (!next) {
        // Path ran off the tree — settle on the deepest resolved node.
        return { node: container, offset: 0 };
      }
      container = next as Element;
    }
    block = container;
  } else {
    const blockIndex = point.path[0];
    if (blockIndex == null) return null;
    block = root.children[blockIndex] ?? null;
  }
  if (!block) return null;

  let remaining = point.offset;
  let result: { node: Node; offset: number } | null = null;
  const walk = (n: Node) => {
    if (result) return;
    if (n.nodeType === 3) {
      const len = n.textContent?.length ?? 0;
      if (remaining <= len) {
        result = { node: n, offset: remaining };
      } else {
        remaining -= len;
      }
    } else {
      for (const c of Array.from(n.childNodes)) {
        walk(c);
        if (result) return;
      }
    }
  };
  walk(block);

  if (!result) {
    // Fall back to the block itself at offset 0
    return { node: block, offset: 0 };
  }
  return result;
}

function lengthOf(n: Node): number {
  if (n.nodeType === 3) return n.textContent?.length ?? 0;
  return n.childNodes.length;
}
