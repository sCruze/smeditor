/**
 * JSON ↔ HTML serialization.
 *
 * The document model is canonical JSON. HTML is just one transport format.
 * Two functions live here:
 *
 *   serializeToHTML(doc, schema) → string
 *   parseHTML(html, schema)      → DocumentJSON
 *
 * Both use the schema's `toDOM` and `parseDOM` declarations on nodes/marks.
 *
 * The serializer is environment-agnostic: it builds an HTML string without
 * touching the live DOM. The parser uses DOMParser when available (browser)
 * and falls back to a minimal regex-tokenizer when not (SSR / tests).
 */

import type {
  CompiledSchema,
  DocumentJSON,
  DocumentNode,
  DOMOutputSpec,
  Mark,
  NodeSpec,
  MarkSpec,
} from "./types.js";

// ============================================================================
// JSON → HTML
// ============================================================================

export function serializeToHTML(
  doc: DocumentJSON,
  schema: CompiledSchema,
): string {
  if (!doc || doc.type !== "doc" || !doc.content) return "";
  return doc.content.map((node) => renderNode(node, schema)).join("");
}

function renderNode(node: DocumentNode, schema: CompiledSchema): string {
  if (node.type === "text") {
    let html = escapeHTML(node.text ?? "");
    // Wrap text in mark elements, innermost first.
    if (node.marks && node.marks.length > 0) {
      for (const mark of node.marks) {
        const spec = schema.marks[mark.type];
        if (!spec?.toDOM) continue;
        html = wrapWithSpec(spec.toDOM(mark), html);
      }
    }
    return html;
  }

  const spec = schema.nodes[node.type];
  if (!spec?.toDOM) {
    // Unknown node — render children if any.
    return (node.content ?? [])
      .map((c) => renderNode(c, schema))
      .join("");
  }

  let inner = (node.content ?? [])
    .map((c) => renderNode(c, schema))
    .join("");

  // An empty leaf block (a blank paragraph, an empty table cell) must
  // still render with a <br> inside it — otherwise the element
  // collapses to zero height in contenteditable and the caret can't
  // be placed there. The parser drops this filler again on the way
  // back, so it never pollutes the JSON model.
  if (
    inner === "" &&
    !spec.atom &&
    typeof spec.content === "string" &&
    spec.content.includes("inline")
  ) {
    inner = "<br>";
  }

  return wrapWithSpec(spec.toDOM(node), inner);
}

function wrapWithSpec(spec: DOMOutputSpec, inner: string): string {
  const arr = spec as unknown[];
  const tag = arr[0] as string;

  // An attrs object (not 0, not an array) may follow the tag.
  let childStart = 1;
  let attrs: Record<string, unknown> | null = null;
  if (
    typeof arr[1] === "object" &&
    arr[1] !== null &&
    !Array.isArray(arr[1])
  ) {
    attrs = arr[1] as Record<string, unknown>;
    childStart = 2;
  }

  const attrStr = attrs ? renderAttrs(attrs) : "";
  if (isVoidTag(tag)) {
    // No trailing slash — `<br>`, `<hr>`, `<img …>` is exactly what a
    // browser's `innerHTML` reports back, so the editor's "did the
    // HTML change?" check stays accurate and the caret isn't lost on
    // no-op re-renders.
    return `<${tag}${attrStr}>`;
  }

  // Remaining entries are children: 0 is the content hole, an array is
  // a nested spec, a string is literal text.
  let body = "";
  for (let i = childStart; i < arr.length; i++) {
    const child = arr[i];
    if (child === 0) {
      body += inner;
    } else if (Array.isArray(child)) {
      body += wrapWithSpec(child as DOMOutputSpec, inner);
    } else if (typeof child === "string") {
      body += escapeHTML(child);
    }
  }
  return `<${tag}${attrStr}>${body}</${tag}>`;
}

function renderAttrs(attrs: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (v === true) {
      parts.push(` ${k}`);
    } else {
      parts.push(` ${k}="${escapeAttr(String(v))}"`);
    }
  }
  return parts.join("");
}

const VOID_TAGS = new Set([
  "br",
  "hr",
  "img",
  "input",
  "meta",
  "link",
  "source",
]);

function isVoidTag(tag: string): boolean {
  return VOID_TAGS.has(tag.toLowerCase());
}

export function escapeHTML(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

// ============================================================================
// HTML → JSON
// ============================================================================

export function parseHTML(
  html: string,
  schema: CompiledSchema,
): DocumentJSON {
  let root: { childNodes: ArrayLike<Node> } | null = null;

  if (typeof DOMParser === "undefined") {
    root = parseHTMLFragment(html) as unknown as { childNodes: ArrayLike<Node> };
  } else {
    const parser = new DOMParser();
    const wrapped = `<div id="__smeditor_root">${html}</div>`;
    const docEl = parser.parseFromString(wrapped, "text/html");
    root = docEl.getElementById("__smeditor_root");
  }

  if (!root) return emptyDoc();

  const content: DocumentNode[] = [];
  for (const child of Array.from(root.childNodes)) {
    const parsed = parseDOMNode(child, schema, []);
    if (parsed) {
      if (Array.isArray(parsed)) content.push(...parsed);
      else content.push(parsed);
    }
  }

  return normalizeTopLevel(content, schema);
}

function emptyDoc(): DocumentJSON {
  return { type: "doc", content: [{ type: "paragraph", content: [] }] };
}

function normalizeTopLevel(
  content: DocumentNode[],
  schema: CompiledSchema,
): DocumentJSON {
  // Ensure top-level only contains block nodes; wrap stray inlines in paragraph.
  const blocks: DocumentNode[] = [];
  let buffer: DocumentNode[] = [];
  const flush = () => {
    if (buffer.length > 0) {
      blocks.push({ type: "paragraph", content: buffer });
      buffer = [];
    }
  };

  for (const node of content) {
    const spec = schema.nodes[node.type];
    if (spec?.group === "inline" || node.type === "text") {
      buffer.push(node);
    } else {
      flush();
      blocks.push(node);
    }
  }
  flush();

  if (blocks.length === 0) {
    blocks.push({ type: "paragraph", content: [] });
  }

  return { type: "doc", content: blocks };
}


/**
 * True when a `<br>` has no meaningful content after it among its
 * following siblings — i.e. it's a filler break at the end of a
 * block, not a genuine line break between two runs of text.
 */
const DROPPED_HTML_TAGS = new Set([
  "script",
  "style",
  "meta",
  "link",
  "title",
  "head",
  "xml",
]);

/** Tags that hold block-level content; used to detect formatting
 *  whitespace that sits between block siblings. */
const PARSER_BLOCK_TAGS = new Set([
  "p", "div", "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li", "table", "thead", "tbody", "tfoot", "tr", "td", "th",
  "blockquote", "pre", "figure", "figcaption", "hr",
  "section", "article", "header", "footer", "main", "aside", "nav",
]);

/**
 * True for a whitespace-only text node that sits purely between block
 * siblings (the newlines/indentation of pretty-printed HTML). Such
 * nodes are formatting, not content — keeping them turned every blank
 * line of imported HTML into a spurious empty paragraph. Whitespace
 * inside an inline run (e.g. the space in `a <strong>b</strong>`) keeps
 * an inline/text sibling, so it is correctly preserved.
 */
function isInsignificantWhitespace(node: Node): boolean {
  if ((node.textContent ?? "").trim() !== "") return false;
  const parent = node.parentNode;
  if (!parent) return false;
  let hasBlockSibling = false;
  for (const sib of Array.from(parent.childNodes)) {
    if (sib === node) continue;
    if (sib.nodeType === 3) {
      if ((sib.textContent ?? "").trim() !== "") return false;
    } else if (sib.nodeType === 1) {
      if (PARSER_BLOCK_TAGS.has((sib as Element).tagName.toLowerCase())) {
        hasBlockSibling = true;
      } else {
        return false;
      }
    }
  }
  return hasBlockSibling;
}

function isTrailingBr(br: Node): boolean {
  // A `<br>` is droppable filler only when it carries no meaningful
  // content on *either* side — i.e. it is the empty-leaf placeholder the
  // serializer emits for a blank block. A `<br>` with real content
  // before it (e.g. `<p>a<br></p>`) is a genuine hard_break and must be
  // preserved so it survives the HTML round-trip; it falls through to
  // the hard_break node rule instead of being discarded.
  return !hasMeaningfulSibling(br, "next") && !hasMeaningfulSibling(br, "prev");
}

function hasMeaningfulSibling(node: Node, dir: "next" | "prev"): boolean {
  let sib: Node | null =
    dir === "next" ? node.nextSibling : node.previousSibling;
  while (sib) {
    if (sib.nodeType === 1) return true;
    if (sib.nodeType === 3 && (sib.textContent ?? "").trim() !== "") {
      return true;
    }
    sib = dir === "next" ? sib.nextSibling : sib.previousSibling;
  }
  return false;
}

/**
 * Parse a DOM node into one or more DocumentNodes.
 * Returns null for nodes that should be dropped (comments, etc.).
 */
function parseDOMNode(
  domNode: Node,
  schema: CompiledSchema,
  activeMarks: Mark[],
): DocumentNode | DocumentNode[] | null {
  // Text node
  if (domNode.nodeType === 3) {
    const text = domNode.textContent ?? "";
    if (text === "") return null;
    // Drop formatting whitespace between block elements so pretty-printed
    // HTML doesn't import as a string of empty paragraphs.
    if (isInsignificantWhitespace(domNode)) return null;
    return {
      type: "text",
      text,
      ...(activeMarks.length > 0 ? { marks: activeMarks.slice() } : {}),
    };
  }

  if (domNode.nodeType !== 1) return null;
  const el = domNode as HTMLElement;
  const tag = el.tagName.toLowerCase();

  if (DROPPED_HTML_TAGS.has(tag) || tag.includes(":")) {
    return null;
  }

  // A <br> with nothing after it is a filler break — the serializer
  // emits one into every empty leaf block so the caret can land
  // there, and browsers insert one into a freshly-emptied block.
  // Either way it carries no document meaning, so drop it. A <br>
  // *followed* by more content is a genuine line break and falls
  // through to the hard_break / soft-break handling below.
  if (tag === "br" && isTrailingBr(domNode)) {
    return null;
  }

  // Try to match a node first — including <br> if a hard_break
  // extension is installed. Nodes take priority over marks because a
  // block element (`<p>`, `<td>`, `<li>`, …) maps to a structural node
  // whose own `getAttrs` turns its inline styles into node attributes
  // (a table cell's `background-color`/`text-align` become cell attrs).
  // The colour/background/font marks register a broad `tag:"*"` rule,
  // so checking marks first let them swallow block elements — a
  // `<td style="background-color:…">` was parsed as a `<span>` mark
  // wrapper, dropping the cell node and its alignment. Marks only apply
  // to inline elements (`<strong>`, `<a>`, `<span>`, …), which never
  // match a node, so they are still reached for those below.
  const nodeSpec = findMatchingNode(tag, el, schema);
  if (nodeSpec) {
    const attrs = extractAttrs(nodeSpec, el);
    const node: DocumentNode = { type: nodeSpec.name };
    if (attrs) node.attrs = attrs;
    // Atom nodes are leaves — their inner DOM is decoration and their
    // data comes from getAttrs, so don't descend into children.
    if (!nodeSpec.atom) {
      const children = parseChildrenFlat(el, schema, activeMarks);
      if (children.length > 0) node.content = children;
    }
    return node;
  }

  // Then match marks. Multiple visual marks may live on the same
  // element, for example `<span style="color:red;background-color:yellow">`.
  // Earlier the parser stopped at the first matching `span` rule, so
  // text colour, background colour and text outline could silently drop
  // one another during HTML → JSON round-trips. Collect every matching
  // mark and carry them all into the children.
  const matchedMarks = findMatchingMarks(tag, el, schema);
  if (matchedMarks.length > 0) {
    return parseChildren(el, schema, [...activeMarks, ...matchedMarks]);
  }

  // Fallback: bare <br> becomes a soft line-break inside text.
  // (If the hard-break extension was registered, the node branch above
  // already produced a real hard_break node and we never get here.)
  if (tag === "br") {
    return { type: "text", text: "\n" };
  }

  // Unknown element — pass children through with current marks.
  return parseChildren(el, schema, activeMarks);
}

function parseChildren(
  el: HTMLElement,
  schema: CompiledSchema,
  activeMarks: Mark[],
): DocumentNode[] {
  const out: DocumentNode[] = [];
  for (const child of Array.from(el.childNodes)) {
    const parsed = parseDOMNode(child, schema, activeMarks);
    if (parsed == null) continue;
    if (Array.isArray(parsed)) out.push(...parsed);
    else out.push(parsed);
  }
  return out;
}

function parseChildrenFlat(
  el: HTMLElement,
  schema: CompiledSchema,
  activeMarks: Mark[],
): DocumentNode[] {
  return parseChildren(el, schema, activeMarks);
}

function findMatchingNode(
  tag: string,
  el: HTMLElement,
  schema: CompiledSchema,
): NodeSpec | null {
  // A rule with a `getAttrs` discriminator (e.g. task_list matching only
  // `<ul class="task-list">`) is more specific than a catch-all tag rule
  // (e.g. bullet_list matching any `<ul>`). When both claim the same tag,
  // the specific one must win regardless of registration order — otherwise
  // a `<ul class="task-list">` parsed as bullet_list and a `<li class=
  // "task-item">` as list_item, so task lists silently degraded to plain
  // lists on every HTML round-trip (including each keystroke in a mounted
  // editor). Take the first discriminating match immediately; fall back to
  // the first catch-all only if nothing more specific matched.
  let fallback: NodeSpec | null = null;
  for (const spec of Object.values(schema.nodes)) {
    if (!spec.parseDOM) continue;
    for (const rule of spec.parseDOM) {
      if (!rule.tag || !tagMatches(rule.tag, tag, el)) continue;
      if (rule.getAttrs) {
        const result = rule.getAttrs(el);
        if (result === false) continue;
        return spec;
      }
      if (!fallback) fallback = spec;
    }
  }
  return fallback;
}

function findMatchingMarks(
  tag: string,
  el: HTMLElement,
  schema: CompiledSchema,
): Mark[] {
  const marks: Mark[] = [];
  for (const spec of Object.values(schema.marks)) {
    if (!spec.parseDOM) continue;
    for (const rule of spec.parseDOM) {
      if (!rule.tag || !tagMatches(rule.tag, tag, el)) continue;

      let attrs: Record<string, unknown> | null = null;
      if (rule.getAttrs) {
        const result = rule.getAttrs(el);
        if (result === false) continue;
        if (result && typeof result === "object") {
          attrs = result as Record<string, unknown>;
        }
      }

      const mark: Mark = { type: spec.name };
      // A getAttrs that matched but produced no attributes (e.g. the
      // span rule for underline returning `{}`) must NOT attach an
      // empty `attrs: {}`, or the same mark gets two JSON shapes
      // ({type} vs {type, attrs:{}}) and the HTML round-trip stops
      // being idempotent — every re-parse looks like a real change and
      // pushes a phantom history entry.
      if (attrs && Object.keys(attrs).length > 0) mark.attrs = attrs;
      marks.push(mark);
      break;
    }
  }
  return marks;
}

const FALLBACK_VOID_TAGS = new Set(["br", "hr", "img", "input", "meta", "link"]);

abstract class MiniNode {
  parentNode: MiniElement | null = null;

  abstract readonly nodeType: number;
  abstract get textContent(): string;

  get nextSibling(): MiniNode | null {
    if (!this.parentNode) return null;
    const index = this.parentNode.childNodes.indexOf(this);
    return index >= 0 ? this.parentNode.childNodes[index + 1] ?? null : null;
  }

  get previousSibling(): MiniNode | null {
    if (!this.parentNode) return null;
    const index = this.parentNode.childNodes.indexOf(this);
    return index > 0 ? this.parentNode.childNodes[index - 1] ?? null : null;
  }
}

class MiniTextNode extends MiniNode {
  readonly nodeType = 3;

  constructor(private readonly value: string) {
    super();
  }

  get textContent(): string {
    return this.value;
  }
}

class MiniElement extends MiniNode {
  readonly nodeType = 1;
  readonly childNodes: MiniNode[] = [];
  readonly tagName: string;
  private readonly attrs: Record<string, string>;

  constructor(tagName: string, attrs: Record<string, string> = {}) {
    super();
    this.tagName = tagName.toUpperCase();
    this.attrs = attrs;
  }

  get textContent(): string {
    return this.childNodes.map((node) => node.textContent).join("");
  }

  appendChild(node: MiniNode): void {
    node.parentNode = this;
    this.childNodes.push(node);
  }

  getAttribute(name: string): string | null {
    return this.attrs[name.toLowerCase()] ?? null;
  }

  querySelector(selector: string): MiniElement | null {
    const wanted = selector.toLowerCase();
    for (const child of this.childNodes) {
      if (child instanceof MiniElement) {
        if (child.tagName.toLowerCase() === wanted) return child;
        const found = child.querySelector(selector);
        if (found) return found;
      }
    }
    return null;
  }

  closest(selector: string): MiniElement | null {
    const wanted = selector.toLowerCase();
    let current: MiniElement | null = this;
    while (current) {
      if (current.tagName.toLowerCase() === wanted) return current;
      current = current.parentNode;
    }
    return null;
  }
}

function parseHTMLFragment(html: string): MiniElement {
  const root = new MiniElement("div");
  const stack: MiniElement[] = [root];
  const tokenRe = /<!--[\s\S]*?-->|<\/[^>]+>|<[^>]+>|[^<]+/g;
  let match: RegExpExecArray | null;

  while ((match = tokenRe.exec(html))) {
    const token = match[0];
    const parent = stack[stack.length - 1];

    if (token.startsWith("<!--")) {
      continue;
    }

    if (token.startsWith("</")) {
      const tag = token.slice(2, -1).trim().toLowerCase();
      const index = stack
        .map((element) => element.tagName.toLowerCase())
        .lastIndexOf(tag);
      if (index > 0) stack.length = index;
      continue;
    }

    if (token.startsWith("<")) {
      const parsed = parseFallbackTag(token);
      if (!parsed) continue;
      const element = new MiniElement(parsed.tagName, parsed.attrs);
      parent.appendChild(element);
      if (!parsed.selfClosing && !FALLBACK_VOID_TAGS.has(parsed.tagName)) {
        stack.push(element);
      }
      continue;
    }

    parent.appendChild(new MiniTextNode(decodeHTML(token)));
  }

  return root;
}

function parseFallbackTag(
  token: string,
): { tagName: string; attrs: Record<string, string>; selfClosing: boolean } | null {
  const source = token.slice(1, -1).trim();
  if (!source || source.startsWith("!")) return null;
  const selfClosing = /\/$/.test(source);
  const cleaned = selfClosing ? source.slice(0, -1).trim() : source;
  const nameMatch = /^([^\s/>]+)/.exec(cleaned);
  if (!nameMatch) return null;

  const tagName = nameMatch[1].toLowerCase();
  const attrs: Record<string, string> = {};
  const attrSource = cleaned.slice(nameMatch[0].length);
  const attrRe = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match: RegExpExecArray | null;

  while ((match = attrRe.exec(attrSource))) {
    const name = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    attrs[name] = decodeHTML(value);
  }

  return { tagName, attrs, selfClosing };
}

function decodeHTML(value: string): string {
  // Single pass so each entity is resolved exactly once. The old
  // chained replaces fed earlier output into later ones, so "&amp;lt;"
  // (literal text "&lt;") was wrongly decoded to "<" \u2014 diverging from
  // the real DOMParser and corrupting text/attribute values in SSR.
  return value.replace(
    /&(?:nbsp|amp|lt|gt|quot|apos|#(\d+)|#x([0-9a-fA-F]+));/gi,
    (match, dec?: string, hex?: string) => {
      if (dec !== undefined) return String.fromCharCode(Number(dec));
      if (hex !== undefined) return String.fromCharCode(parseInt(hex, 16));
      switch (match.slice(1, -1).toLowerCase()) {
        case "nbsp":
          return "\u00a0";
        case "amp":
          return "&";
        case "lt":
          return "<";
        case "gt":
          return ">";
        case "quot":
          return '"';
        case "apos":
          return "'";
        default:
          return match;
      }
    },
  );
}

function tagMatches(
  ruleTag: string,
  actualTag: string,
  el?: HTMLElement,
): boolean {
  const normalised = ruleTag.toLowerCase();
  const bracket = normalised.indexOf("[");
  if (bracket === -1) {
    return normalised === "*" || normalised === actualTag;
  }
  // Attribute-selector form: "span[data-mention-id]" or "a[href=x]".
  // The bare tag name must match, then every bracketed predicate is
  // verified against the element. Without this, extensions whose
  // parseDOM rule is an attribute selector (mention, comment) never
  // matched and their nodes/marks were lost on HTML import.
  const name = normalised.slice(0, bracket);
  if (name !== "*" && name !== actualTag) return false;
  if (!el) return false;
  const predicate = /\[\s*([a-z0-9_-]+)\s*(?:=\s*"?([^\]"]*)"?\s*)?\]/g;
  let m: RegExpExecArray | null;
  while ((m = predicate.exec(normalised))) {
    const have = el.getAttribute(m[1]);
    if (have == null) return false;
    if (m[2] !== undefined && have.toLowerCase() !== m[2]) return false;
  }
  return true;
}

function extractAttrs(
  spec: NodeSpec | MarkSpec,
  el: HTMLElement,
): Record<string, unknown> | null {
  if (!spec.parseDOM) return null;
  const tag = el.tagName.toLowerCase();
  for (const rule of spec.parseDOM) {
    if (rule.tag && tagMatches(rule.tag, tag, el)) {
      if (rule.getAttrs) {
        const result = rule.getAttrs(el);
        if (result && typeof result === "object") {
          return result as Record<string, unknown>;
        }
      }
      return null;
    }
  }
  return null;
}
