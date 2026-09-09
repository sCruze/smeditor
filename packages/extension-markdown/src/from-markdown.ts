/**
 * Markdown parsing — Markdown text → `DocumentJSON`.
 *
 * Covers the import side of §16. A pure function, no DOM.
 *
 * A compact, line-oriented parser handling the everyday CommonMark
 * constructs: ATX and setext headings, nested bullet / ordered / task
 * lists, blockquotes, fenced code, rules, GitHub tables, and the
 * common inline marks (bold, italic, code, strike) plus inline and
 * reference links / images. It is not a byte-exact CommonMark
 * implementation — HTML blocks and a few rare corners are out of
 * scope — but it round-trips everything SMEditor itself produces and
 * the bulk of hand-written Markdown. Anything unrecognised becomes a
 * paragraph.
 */

import type { DocumentJSON, DocumentNode } from "@smeditor/core";

// ============================================================================
// Link reference definitions
// ============================================================================

interface LinkDef {
  href: string;
  title?: string;
}
type LinkDefs = Map<string, LinkDef>;

/** A line like `[label]: https://example.com "Optional title"`. */
const LINK_DEF =
  /^ {0,3}\[([^\]]+)\]:\s*<?([^\s>]+)>?(?:\s+["'(](.*)["')])?\s*$/;

/**
 * Pull link reference definitions out of the document. Returns the
 * definitions plus the remaining lines (definition lines blanked, so
 * indices are preserved for the block scanner).
 */
function extractLinkDefs(lines: string[]): {
  defs: LinkDefs;
  rest: string[];
} {
  const defs: LinkDefs = new Map();
  const rest = lines.slice();
  for (let i = 0; i < rest.length; i++) {
    const m = LINK_DEF.exec(rest[i]);
    if (m) {
      const key = m[1].trim().toLowerCase();
      if (!defs.has(key)) {
        defs.set(key, m[3] ? { href: m[2], title: m[3] } : { href: m[2] });
      }
      rest[i] = "";
    }
  }
  return { defs, rest };
}

// ============================================================================
// Inline
// ============================================================================

interface MarkSpan {
  type: string;
  attrs?: Record<string, unknown>;
}

/**
 * Parse inline Markdown into an array of text / image nodes. Handles
 * (in precedence order) code spans, images, inline + reference links,
 * bold+italic, bold, italic, strike.
 */
function parseInline(text: string, defs: LinkDefs): DocumentNode[] {
  const out: DocumentNode[] = [];

  const emit = (raw: string, marks: MarkSpan[]) => {
    if (!raw) return;
    const node: DocumentNode = { type: "text", text: raw };
    if (marks.length) node.marks = marks;
    out.push(node);
  };

  let i = 0;
  let plain = "";
  const flushPlain = () => {
    if (plain) {
      emit(unescape(plain), []);
      plain = "";
    }
  };

  while (i < text.length) {
    const rest = text.slice(i);

    // Escaped character — take the next char literally.
    if (rest[0] === "\\" && rest.length > 1) {
      plain += rest[1];
      i += 2;
      continue;
    }

    // Image: ![alt](src)
    let m = /^!\[([^\]]*)\]\(([^)]*)\)/.exec(rest);
    if (m) {
      flushPlain();
      out.push({ type: "image", attrs: { src: m[2], alt: m[1] } });
      i += m[0].length;
      continue;
    }

    // Reference image: ![alt][label] / ![alt][]
    m = /^!\[([^\]]*)\]\[([^\]]*)\]/.exec(rest);
    if (m) {
      const def = defs.get((m[2].trim() || m[1].trim()).toLowerCase());
      if (def) {
        flushPlain();
        out.push({ type: "image", attrs: { src: def.href, alt: m[1] } });
        i += m[0].length;
        continue;
      }
    }

    // Inline link: [text](href)
    m = /^\[([^\]]*)\]\(([^)]*)\)/.exec(rest);
    if (m) {
      flushPlain();
      emit(m[1], [{ type: "link", attrs: { href: m[2] } }]);
      i += m[0].length;
      continue;
    }

    // Reference link, full / collapsed: [text][label] / [text][]
    m = /^\[([^\]]+)\]\[([^\]]*)\]/.exec(rest);
    if (m) {
      const def = defs.get((m[2].trim() || m[1].trim()).toLowerCase());
      if (def) {
        flushPlain();
        emit(m[1], [{ type: "link", attrs: { href: def.href } }]);
        i += m[0].length;
        continue;
      }
    }

    // Reference link, shortcut: [label] — only if the label is defined,
    // otherwise the brackets are literal text.
    m = /^\[([^\]]+)\]/.exec(rest);
    if (m) {
      const def = defs.get(m[1].trim().toLowerCase());
      if (def) {
        flushPlain();
        emit(m[1], [{ type: "link", attrs: { href: def.href } }]);
        i += m[0].length;
        continue;
      }
    }

    // Code span: `code`
    m = /^`([^`]+)`/.exec(rest);
    if (m) {
      flushPlain();
      emit(m[1], [{ type: "code" }]);
      i += m[0].length;
      continue;
    }

    // Bold + italic: ***text***
    m = /^\*\*\*([^*]+)\*\*\*/.exec(rest);
    if (m) {
      flushPlain();
      emit(m[1], [{ type: "bold" }, { type: "italic" }]);
      i += m[0].length;
      continue;
    }

    // Bold: **text**
    m = /^\*\*([^*]+)\*\*/.exec(rest);
    if (m) {
      flushPlain();
      emit(m[1], [{ type: "bold" }]);
      i += m[0].length;
      continue;
    }

    // Strike: ~~text~~
    m = /^~~([^~]+)~~/.exec(rest);
    if (m) {
      flushPlain();
      emit(m[1], [{ type: "strike" }]);
      i += m[0].length;
      continue;
    }

    // Italic: *text*  (single asterisk, non-greedy)
    m = /^\*([^*]+)\*/.exec(rest);
    if (m) {
      flushPlain();
      emit(m[1], [{ type: "italic" }]);
      i += m[0].length;
      continue;
    }

    plain += rest[0];
    i += 1;
  }
  flushPlain();
  return out;
}

function unescape(text: string): string {
  return text.replace(/\\([\\`*_{}\[\]()#+\-.!~|])/g, "$1");
}

// ============================================================================
// Lists (nesting-aware)
// ============================================================================

const BULLET = /^(\s*)[-*+]\s+/;
const ORDERED = /^(\s*)\d+\.\s+/;
const TASK = /^(\s*)[-*+]\s+\[[ xX]\]\s/;

/** Leading-space count of a line. */
function indentOf(line: string): number {
  const m = /^(\s*)/.exec(line);
  return m ? m[1].length : 0;
}

/** Which list marker, if any, a line carries. */
function listKind(line: string): "bullet" | "ordered" | "task" | null {
  if (TASK.test(line)) return "task";
  if (BULLET.test(line)) return "bullet";
  if (ORDERED.test(line)) return "ordered";
  return null;
}

/** Strip the marker, returning the item's text content. */
function itemText(line: string, kind: string): string {
  if (kind === "task") {
    return line.replace(/^\s*[-*+]\s+\[[ xX]\]\s+/, "");
  }
  if (kind === "ordered") return line.replace(ORDERED, "");
  return line.replace(BULLET, "");
}

/** A line continues the current list-item if it's indented and not a marker. */
function isTaskChecked(line: string): boolean {
  const m = /^\s*[-*+]\s+\[([ xX])\]/.exec(line);
  return !!m && m[1].toLowerCase() === "x";
}

/**
 * Parse a list starting at `start`. A line indented at least two
 * spaces past the current level opens a nested list attached to the
 * preceding item. Returns the list node and the index after it.
 */
function parseList(
  lines: string[],
  start: number,
  defs: LinkDefs,
): { node: DocumentNode; next: number } {
  const baseIndent = indentOf(lines[start]);
  const baseKind = listKind(lines[start])!;
  const items: DocumentNode[] = [];
  let i = start;

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      // A blank line followed by a same-level item keeps the list
      // going (a loose list); anything else ends it.
      const peek = i + 1;
      if (
        peek < lines.length &&
        listKind(lines[peek]) &&
        indentOf(lines[peek]) <= baseIndent + 1
      ) {
        i++;
        continue;
      }
      break;
    }

    const kind = listKind(line);
    if (!kind) break;
    const indent = indentOf(line);
    if (indent < baseIndent) break; // belongs to an outer list

    if (indent >= baseIndent + 2 && items.length > 0) {
      // Nested list — attach to the last item.
      const { node, next } = parseList(lines, i, defs);
      const last = items[items.length - 1];
      last.content = [...(last.content ?? []), node];
      i = next;
      continue;
    }

    // A same-level item.
    const text = itemText(line, kind);
    if (baseKind === "task") {
      items.push({
        type: "task_item",
        attrs: { checked: isTaskChecked(line) },
        content: [{ type: "paragraph", content: parseInline(text, defs) }],
      });
    } else {
      items.push({
        type: "list_item",
        content: [{ type: "paragraph", content: parseInline(text, defs) }],
      });
    }
    i++;
  }

  const listType =
    baseKind === "task"
      ? "task_list"
      : baseKind === "ordered"
        ? "ordered_list"
        : "bullet_list";
  return { node: { type: listType, content: items }, next: i };
}

// ============================================================================
// Block scanning
// ============================================================================

function isTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/.test(line);
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());
}

/** Parse a Markdown string into a SMEditor document. */
export function fromMarkdown(md: string): DocumentJSON {
  const raw = md.replace(/\r\n?/g, "\n").split("\n");
  const { defs, rest: lines } = extractLinkDefs(raw);
  const blocks: DocumentNode[] = [];
  let i = 0;

  const paragraph = (text: string): DocumentNode => ({
    type: "paragraph",
    content: parseInline(text, defs),
  });
  const cell = (text: string): DocumentNode => ({
    type: "table_cell",
    content: [paragraph(text)],
  });

  while (i < lines.length) {
    const line = lines[i];

    // Blank line — skip.
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Fenced code block.
    const fence = /^(```|~~~)/.exec(line);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith(fence[1])) {
        body.push(lines[i]);
        i++;
      }
      i++; // closing fence
      blocks.push({
        type: "code_block",
        content: [{ type: "text", text: body.join("\n") }],
      });
      continue;
    }

    // Horizontal rule.
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push({ type: "horizontal_rule" });
      i++;
      continue;
    }

    // ATX heading.
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({
        type: "heading",
        attrs: { level: heading[1].length },
        content: parseInline(heading[2].trim(), defs),
      });
      i++;
      continue;
    }

    // Setext heading — a text line underlined with === or ---.
    if (
      i + 1 < lines.length &&
      line.trim() !== "" &&
      !listKind(line) &&
      /^\s*(=+|-+)\s*$/.test(lines[i + 1]) &&
      !/^\s*-{3,}\s*$/.test(line)
    ) {
      const level = lines[i + 1].trim().startsWith("=") ? 1 : 2;
      blocks.push({
        type: "heading",
        attrs: { level },
        content: parseInline(line.trim(), defs),
      });
      i += 2;
      continue;
    }

    // Blockquote — collect consecutive `>` lines.
    if (/^\s*>\s?/.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quoted.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      blocks.push({
        type: "blockquote",
        content: [paragraph(quoted.join(" ").trim())],
      });
      continue;
    }

    // Table — a header row followed by a separator row.
    if (
      line.includes("|") &&
      i + 1 < lines.length &&
      isTableSeparator(lines[i + 1])
    ) {
      const header = splitTableRow(line);
      i += 2; // header + separator
      const rows: DocumentNode[] = [
        {
          type: "table_row",
          content: header.map((t) => {
            const c = cell(t);
            c.attrs = { header: true };
            return c;
          }),
        },
      ];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        rows.push({
          type: "table_row",
          content: splitTableRow(lines[i]).map(cell),
        });
        i++;
      }
      blocks.push({ type: "table", content: rows });
      continue;
    }

    // Lists — bullet / ordered / task, nesting-aware.
    if (listKind(line)) {
      const { node, next } = parseList(lines, i, defs);
      blocks.push(node);
      i = next;
      continue;
    }

    // Paragraph — gather consecutive non-blank, non-special lines.
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== "") {
      const l = lines[i];
      if (
        /^(#{1,6})\s/.test(l) ||
        /^\s*>/.test(l) ||
        /^(```|~~~)/.test(l) ||
        listKind(l) ||
        /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l)
      ) {
        if (para.length > 0) break;
      }
      // A setext underline ends the paragraph (and re-tags it above).
      if (para.length > 0 && /^\s*(=+|-+)\s*$/.test(l)) break;
      para.push(l);
      i++;
    }
    if (para.length) blocks.push(paragraph(para.join(" ")));
  }

  if (blocks.length === 0) blocks.push({ type: "paragraph" });
  return { type: "doc", content: blocks };
}
