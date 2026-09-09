/**
 * @smeditor/extension-track-changes
 *
 * Track changes (§14, phase 3). Edits are recorded as marks rather
 * than applied destructively:
 *
 *   - `insertion` — text added while tracking; rendered as `<ins>`.
 *   - `deletion`  — text removed while tracking; rendered as `<del>`,
 *     the text kept until the change is accepted.
 *
 * Each mark carries an `author` and a `timestamp`. Accepting or
 * rejecting resolves the marks into a clean document.
 *
 * This iteration provides the marks, the accept/reject transforms,
 * and `getChanges` for building review UI. Intercepting live typing
 * so edits are *automatically* marked is the next step — for now an
 * integration marks ranges explicitly with `markInsertion` /
 * `markDeletion`.
 */

import type {
  Extension,
  EditorInstance,
  DocumentJSON,
  DocumentNode,
  Mark,
  DOMOutputSpec,
} from "@smeditor/core";
import {
  applyMarkToInlineRange,
  insertInlineAt,
  inlineLength,
  nodeAt,
  mapNodeAt,
} from "@smeditor/core";

// ============================================================================
// Marks
// ============================================================================

const insertionMark = {
  name: "insertion",
  inclusive: true,
  attrs: { author: { default: null }, timestamp: { default: null } },
  toDOM: (mark: Mark): DOMOutputSpec => [
    "ins",
    {
      class: "smeditor-insertion",
      "data-author": String(mark.attrs?.author ?? ""),
    },
    0,
  ],
  parseDOM: [{ tag: "ins" }],
};

const deletionMark = {
  name: "deletion",
  inclusive: true,
  attrs: { author: { default: null }, timestamp: { default: null } },
  toDOM: (mark: Mark): DOMOutputSpec => [
    "del",
    {
      class: "smeditor-deletion",
      "data-author": String(mark.attrs?.author ?? ""),
    },
    0,
  ],
  parseDOM: [{ tag: "del" }],
};

// ============================================================================
// Resolving changes
// ============================================================================

function hasMark(node: DocumentNode, type: string): boolean {
  return !!node.marks?.some((m) => m.type === type);
}

function stripMark(node: DocumentNode, type: string): DocumentNode {
  const marks = (node.marks ?? []).filter((m) => m.type !== type);
  const out: DocumentNode = { type: "text", text: node.text };
  if (marks.length) out.marks = marks;
  return out;
}

/**
 * Resolve every tracked change. `accept` keeps insertions (as plain
 * text) and removes deleted text; `reject` does the opposite. Pure —
 * returns a new document.
 */
function resolveChanges(
  doc: DocumentJSON,
  mode: "accept" | "reject",
): DocumentJSON {
  const transform = (nodes: DocumentNode[]): DocumentNode[] => {
    const out: DocumentNode[] = [];
    for (const n of nodes) {
      if (n.type === "text") {
        const ins = hasMark(n, "insertion");
        const del = hasMark(n, "deletion");
        if (mode === "accept") {
          if (del) continue; // deleted text is dropped
          out.push(ins ? stripMark(n, "insertion") : n);
        } else {
          if (ins) continue; // inserted text is dropped
          out.push(del ? stripMark(n, "deletion") : n);
        }
        continue;
      }
      const node: DocumentNode = { ...n };
      if (n.content) node.content = transform(n.content);
      out.push(node);
    }
    return out;
  };
  return { ...doc, content: transform(doc.content ?? []) };
}

export interface TrackedChange {
  type: "insertion" | "deletion";
  author: string | null;
  timestamp: number | null;
  text: string;
}

/** Collect every tracked change in the document, in reading order. */
export function getChanges(doc: DocumentJSON): TrackedChange[] {
  const changes: TrackedChange[] = [];
  const walk = (node: DocumentNode) => {
    if (node.type === "text" && node.marks) {
      for (const m of node.marks) {
        if (m.type === "insertion" || m.type === "deletion") {
          changes.push({
            type: m.type,
            author: (m.attrs?.author as string) ?? null,
            timestamp: (m.attrs?.timestamp as number) ?? null,
            text: node.text ?? "",
          });
        }
      }
    }
    node.content?.forEach(walk);
  };
  doc.content?.forEach(walk);
  return changes;
}

// re-export the pure transforms for testing / host use
export { resolveChanges };

/**
 * Resolve a single tracked change, identified by its index in
 * `getChanges` order. `accept` keeps an insertion / drops a deletion;
 * `reject` does the opposite. Other changes are left untouched. Pure.
 */
export function resolveChange(
  doc: DocumentJSON,
  changeIndex: number,
  mode: "accept" | "reject",
): DocumentJSON {
  let counter = 0;
  const transform = (nodes: DocumentNode[]): DocumentNode[] => {
    const out: DocumentNode[] = [];
    for (const n of nodes) {
      if (n.type === "text" && n.marks) {
        const tracked = n.marks.filter(
          (m) => m.type === "insertion" || m.type === "deletion",
        );
        if (tracked.length) {
          // getChanges emits one entry per tracked mark, so advance the
          // counter per mark to share its index space. A node carrying
          // both an insertion and a deletion mark occupies two indices.
          let resolved: DocumentNode | null = n; // null => node dropped
          let touched = false;
          for (const mark of tracked) {
            const isTarget = counter === changeIndex;
            counter++;
            if (!isTarget || resolved === null) continue;
            touched = true;
            if (mode === "accept") {
              if (mark.type === "deletion") {
                resolved = null; // drop deleted text
              } else {
                resolved = stripMark(resolved, "insertion"); // keep insertion as plain text
              }
            } else {
              if (mark.type === "insertion") {
                resolved = null; // drop inserted text
              } else {
                resolved = stripMark(resolved, "deletion"); // restore deleted text
              }
            }
          }
          if (resolved !== null) out.push(touched ? resolved : n);
          continue;
        }
      }
      const node: DocumentNode = { ...n };
      if (n.content) node.content = transform(n.content);
      out.push(node);
    }
    return out;
  };
  return { ...doc, content: transform(doc.content ?? []) };
}

// ============================================================================
// Extension
// ============================================================================

/** Offsets of the selection range within one block, document-ordered. */
function rangeInBlock(
  editor: EditorInstance,
): { index: number; from: number; to: number } | null {
  const sel = editor.getSelection();
  if (!sel) return null;
  const aIdx = sel.anchor.path[0] ?? 0;
  const hIdx = sel.head.path[0] ?? 0;
  if (aIdx !== hIdx) return null; // single-block ranges only, for now
  const from = Math.min(sel.anchor.offset, sel.head.offset);
  const to = Math.max(sel.anchor.offset, sel.head.offset);
  if (to <= from) return null;
  return { index: aIdx, from, to };
}

// ============================================================================
// Live tracking — state + transforms
// ============================================================================

interface TrackingState {
  enabled: boolean;
  author: string | null;
}

/** Per-editor tracking state — keyed weakly so it's GC-friendly. */
const trackingStates = new WeakMap<EditorInstance, TrackingState>();

function stateOf(editor: EditorInstance): TrackingState {
  let s = trackingStates.get(editor);
  if (!s) {
    s = { enabled: false, author: null };
    trackingStates.set(editor, s);
  }
  return s;
}

/** Whether live change-tracking is on for this editor. */
export function isTrackingEnabled(editor: EditorInstance): boolean {
  return stateOf(editor).enabled;
}

interface TrackedResult {
  doc: DocumentJSON;
  caret: { path: number[]; offset: number };
}

/**
 * Insert `text` at `point`, wrapped in an insertion mark. Pure.
 * Returns the new document and the caret position after the text.
 */
export function insertTrackedText(
  doc: DocumentJSON,
  point: { path: number[]; offset: number },
  text: string,
  author: string | null,
): TrackedResult | null {
  const block = nodeAt(doc, point.path);
  if (!block) return null;
  const inserted: DocumentNode = {
    type: "text",
    text,
    marks: [{ type: "insertion", attrs: { author, timestamp: Date.now() } }],
  };
  const content = insertInlineAt(block.content ?? [], point.offset, [
    inserted,
  ]);
  const newDoc = mapNodeAt(doc, point.path, (b) => ({ ...b, content }));
  return {
    doc: newDoc,
    caret: { path: point.path, offset: point.offset + text.length },
  };
}

/**
 * Mark one character adjacent to `point` for deletion instead of
 * removing it. `backward` marks the character before the caret (and
 * moves the caret back over it); `forward` marks the one after. Pure.
 */
export function markDeleteAt(
  doc: DocumentJSON,
  point: { path: number[]; offset: number },
  direction: "backward" | "forward",
  author: string | null,
): TrackedResult | null {
  const block = nodeAt(doc, point.path);
  if (!block?.content) return null;
  const length = inlineLength(block);

  let from: number;
  let to: number;
  let caretOffset: number;
  if (direction === "backward") {
    if (point.offset <= 0) return null;
    from = point.offset - 1;
    to = point.offset;
    caretOffset = from;
  } else {
    if (point.offset >= length) return null;
    from = point.offset;
    to = point.offset + 1;
    caretOffset = point.offset;
  }

  const mark: Mark = {
    type: "deletion",
    attrs: { author, timestamp: Date.now() },
  };
  const content = applyMarkToInlineRange(block.content, from, to, mark);
  const newDoc = mapNodeAt(doc, point.path, (b) => ({ ...b, content }));
  return {
    doc: newDoc,
    caret: { path: point.path, offset: caretOffset },
  };
}

/** True when the selection is collapsed (a caret, not a range). */
function isCollapsed(editor: EditorInstance): boolean {
  const sel = editor.getSelection();
  if (!sel) return false;
  return (
    sel.anchor.path.join(",") === sel.head.path.join(",") &&
    sel.anchor.offset === sel.head.offset
  );
}

export const TrackChangesExtension: Extension = {
  name: "track_changes",
  marks: [insertionMark, deletionMark],
  commands: {
    /** markInsertion({ author }) — mark the selected range as inserted. */
    markInsertion:
      (opts: { author?: string } = {}) =>
      (editor: EditorInstance): boolean =>
        markRange(editor, "insertion", opts.author),

    /** markDeletion({ author }) — mark the selected range as deleted. */
    markDeletion:
      (opts: { author?: string } = {}) =>
      (editor: EditorInstance): boolean =>
        markRange(editor, "deletion", opts.author),

    /** acceptAllChanges — keep insertions, drop deletions. */
    acceptAllChanges:
      () =>
      (editor: EditorInstance): boolean => {
        const next = resolveChanges(editor.getJSON(), "accept");
        editor.dispatch({
          doc: next,
          selection: editor.getSelection(),
          addToHistory: true,
        });
        return true;
      },

    /** rejectAllChanges — drop insertions, restore deletions. */
    rejectAllChanges:
      () =>
      (editor: EditorInstance): boolean => {
        const next = resolveChanges(editor.getJSON(), "reject");
        editor.dispatch({
          doc: next,
          selection: editor.getSelection(),
          addToHistory: true,
        });
        return true;
      },

    /** acceptChange({ index }) — accept one change by getChanges index. */
    acceptChange:
      (opts: { index: number }) =>
      (editor: EditorInstance): boolean => {
        if (typeof opts?.index !== "number") return false;
        const next = resolveChange(editor.getJSON(), opts.index, "accept");
        editor.dispatch({
          doc: next,
          selection: editor.getSelection(),
          addToHistory: true,
        });
        return true;
      },

    /** rejectChange({ index }) — reject one change by getChanges index. */
    rejectChange:
      (opts: { index: number }) =>
      (editor: EditorInstance): boolean => {
        if (typeof opts?.index !== "number") return false;
        const next = resolveChange(editor.getJSON(), opts.index, "reject");
        editor.dispatch({
          doc: next,
          selection: editor.getSelection(),
          addToHistory: true,
        });
        return true;
      },

    /** setTracking({ enabled, author }) — turn live tracking on/off. */
    setTracking:
      (opts: { enabled: boolean; author?: string }) =>
      (editor: EditorInstance): boolean => {
        const s = stateOf(editor);
        s.enabled = !!opts?.enabled;
        if (opts?.author !== undefined) s.author = opts.author;
        return true;
      },

    /** toggleTracking — flip live tracking on/off. */
    toggleTracking:
      (opts: { author?: string } = {}) =>
      (editor: EditorInstance): boolean => {
        const s = stateOf(editor);
        s.enabled = !s.enabled;
        if (opts?.author !== undefined) s.author = opts.author;
        return true;
      },
  },

  // --- Live interception --------------------------------------------------

  handleTextInput: (editor: EditorInstance, text: string): boolean => {
    const state = stateOf(editor);
    if (!state.enabled) return false;
    // Only collapsed carets for now — a typed replacement of a
    // selected range is handled natively.
    if (!isCollapsed(editor)) return false;
    const sel = editor.getSelection();
    if (!sel) return false;
    const result = insertTrackedText(
      editor.getJSON(),
      sel.anchor,
      text,
      state.author,
    );
    if (!result) return false;
    editor.dispatch({
      doc: result.doc,
      selection: {
        anchor: result.caret,
        head: result.caret,
      },
      addToHistory: true,
    });
    return true;
  },

  handleDeleteContent: (
    editor: EditorInstance,
    direction: "backward" | "forward",
  ): boolean => {
    const state = stateOf(editor);
    if (!state.enabled) return false;
    if (!isCollapsed(editor)) return false;
    const sel = editor.getSelection();
    if (!sel) return false;
    const result = markDeleteAt(
      editor.getJSON(),
      sel.anchor,
      direction,
      state.author,
    );
    if (!result) return false;
    editor.dispatch({
      doc: result.doc,
      selection: {
        anchor: result.caret,
        head: result.caret,
      },
      addToHistory: true,
    });
    return true;
  },
};

function markRange(
  editor: EditorInstance,
  type: "insertion" | "deletion",
  author?: string,
): boolean {
  const range = rangeInBlock(editor);
  if (!range) return false;
  const doc = structuredCloneDoc(editor.getJSON());
  const block = doc.content[range.index];
  if (!block?.content) return false;
  const mark: Mark = {
    type,
    attrs: { author: author ?? null, timestamp: Date.now() },
  };
  block.content = applyMarkToInlineRange(
    block.content,
    range.from,
    range.to,
    mark,
  );
  editor.dispatch({
    doc,
    selection: editor.getSelection(),
    addToHistory: true,
  });
  return true;
}

/** Minimal deep clone (avoids importing cloneDoc for one use). */
function structuredCloneDoc(doc: DocumentJSON): DocumentJSON {
  return JSON.parse(JSON.stringify(doc)) as DocumentJSON;
}

export default TrackChangesExtension;
