/**
 * @smeditor/export-pdf — layout
 *
 * Turns a SMEditor document into a flat list of *typeset lines* — a
 * simple block-flow layout: paragraphs and headings stacked top to
 * bottom, text wrapped to the content width, lists indented with a
 * marker.
 *
 * The layout is deliberately basic. It handles paragraph flow,
 * heading sizes, blockquotes, code blocks and lists. It does not do
 * rich layout — tables are rendered as plain indented lines, images
 * as their alt text, and there is no float / wrap-around. A
 * full-fidelity PDF would need a real text-layout engine; this aims
 * to be a faithful, readable text export.
 *
 * This module is pure: it needs only a text-measuring function, so
 * the wrapping logic is unit-testable without pdf-lib.
 */

import type { DocumentJSON, DocumentNode } from "@smeditor/core";

/** Measures the width of a string at a given font size and weight. */
export type MeasureText = (
  text: string,
  size: number,
  bold: boolean,
) => number;

/** One run of text within a line, with its styling. */
export interface LineSpan {
  text: string;
  bold: boolean;
  italic: boolean;
}

/** A single typeset line, ready to be drawn. */
export interface TypesetLine {
  spans: LineSpan[];
  /** Font size in points. */
  size: number;
  /** Left indent in points. */
  indent: number;
  /** Extra space before this line (paragraph gap), in points. */
  spaceBefore: number;
  /** True for code lines — drawn in a mono font. */
  mono: boolean;
}

export interface LayoutOptions {
  /** Content width available for text, in points. */
  contentWidth: number;
  /** Base font size for body text. */
  baseSize?: number;
}

const HEADING_SIZES = [24, 20, 17, 15, 13, 12];

/** A tab expands to this many spaces. */
const TAB_WIDTH = 4;

/**
 * Normalize a raw text string for typesetting: expand tabs to spaces
 * and drop any other control characters (char code < 0x20) that the
 * StandardFont WinAnsi encoder cannot encode. Newlines are handled by
 * the caller (split into hard-break sentinels), so they are not
 * expected here.
 */
function cleanText(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (ch === "\t") {
      out += " ".repeat(TAB_WIDTH);
    } else if (code < 0x20) {
      // Strip other control characters (e.g. carriage return); these
      // cannot be encoded by WinAnsi and would crash pdf-lib.
      continue;
    } else {
      out += ch;
    }
  }
  return out;
}

/** Collect a text node's styling from its marks. */
function marksOf(node: DocumentNode): { bold: boolean; italic: boolean } {
  const marks = node.marks ?? [];
  return {
    bold: marks.some((m) => m.type === "bold"),
    italic: marks.some((m) => m.type === "italic"),
  };
}

/**
 * Emit styled spans for a text node, splitting any embedded newlines
 * into standalone hard-break sentinel spans (text === "\n", the value
 * wrapSpans treats as a forced line break) and expanding tabs.
 */
function pushTextNode(spans: LineSpan[], node: DocumentNode): void {
  const { bold, italic } = marksOf(node);
  const raw = node.text ?? "";
  const segments = raw.split("\n");
  segments.forEach((segment, i) => {
    if (i > 0) spans.push({ text: "\n", bold: false, italic: false });
    spans.push({ text: cleanText(segment), bold, italic });
  });
}

/** Flatten a block's inline content into styled spans. */
function inlineSpans(node: DocumentNode): LineSpan[] {
  const spans: LineSpan[] = [];
  for (const child of node.content ?? []) {
    if (child.type === "text") {
      pushTextNode(spans, child);
    } else if (child.type === "hard_break") {
      spans.push({ text: "\n", bold: false, italic: false });
    } else if (child.text) {
      pushTextNode(spans, child);
    }
  }
  return spans;
}

/**
 * Wrap a sequence of spans to `maxWidth`, returning lines of spans.
 * Wrapping happens at spaces; a hard break span ("\n") forces a line.
 */
function wrapSpans(
  spans: LineSpan[],
  size: number,
  maxWidth: number,
  measure: MeasureText,
): LineSpan[][] {
  const lines: LineSpan[][] = [];
  let current: LineSpan[] = [];
  let width = 0;

  const pushLine = () => {
    lines.push(current);
    current = [];
    width = 0;
  };

  for (const span of spans) {
    if (span.text === "\n") {
      pushLine();
      continue;
    }
    // Split into words, keeping spaces attached for measurement.
    const words = span.text.split(/(\s+)/).filter((w) => w !== "");
    for (const word of words) {
      const w = measure(word, size, span.bold);
      if (width + w > maxWidth && current.length > 0 && word.trim() !== "") {
        pushLine();
      }
      const last = current[current.length - 1];
      if (last && last.bold === span.bold && last.italic === span.italic) {
        last.text += word;
      } else {
        current.push({ ...span, text: word });
      }
      width += w;
    }
  }
  if (current.length > 0 || lines.length === 0) pushLine();
  return lines;
}

/** Lay out one block node into typeset lines. */
function layoutBlock(
  node: DocumentNode,
  opts: Required<LayoutOptions>,
  measure: MeasureText,
  indent: number,
): TypesetLine[] {
  const { contentWidth, baseSize } = opts;
  const avail = contentWidth - indent;
  const out: TypesetLine[] = [];

  const emitParagraph = (
    block: DocumentNode,
    size: number,
    gap: number,
    mono = false,
  ) => {
    const lines = wrapSpans(inlineSpans(block), size, avail, measure);
    lines.forEach((spans, i) => {
      out.push({
        spans: spans.length ? spans : [{ text: "", bold: false, italic: false }],
        size,
        indent,
        spaceBefore: i === 0 ? gap : size * 0.3,
        mono,
      });
    });
  };

  switch (node.type) {
    case "paragraph":
      emitParagraph(node, baseSize, baseSize * 0.6);
      break;
    case "heading": {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level ?? 1)));
      emitParagraph(node, HEADING_SIZES[level - 1], baseSize * 1.1);
      break;
    }
    case "blockquote":
      for (const child of node.content ?? []) {
        out.push(
          ...layoutBlock(child, opts, measure, indent + 24),
        );
      }
      break;
    case "code_block":
      emitParagraph(node, baseSize - 1, baseSize * 0.6, true);
      break;
    case "bullet_list":
    case "ordered_list":
    case "task_list": {
      const items = node.content ?? [];
      items.forEach((item, idx) => {
        const marker =
          node.type === "ordered_list" ? `${idx + 1}. ` : "\u2022 ";
        const leaves = item.content ?? [];
        leaves.forEach((leaf, li) => {
          const prefixed: DocumentNode =
            li === 0
              ? {
                  ...leaf,
                  content: [
                    { type: "text", text: marker },
                    ...(leaf.content ?? []),
                  ],
                }
              : leaf;
          out.push(...layoutBlock(prefixed, opts, measure, indent + 18));
        });
      });
      break;
    }
    case "horizontal_rule":
      out.push({
        spans: [
          {
            text: "\u2014".repeat(Math.max(1, Math.floor(avail / 6))),
            bold: false,
            italic: false,
          },
        ],
        size: baseSize,
        indent,
        spaceBefore: baseSize,
        mono: false,
      });
      break;
    case "table":
      // Basic: each row becomes a tab-separated line.
      for (const row of node.content ?? []) {
        const cellText = (row.content ?? [])
          .map((cell) =>
            (cell.content ?? [])
              .map((b) => inlineSpans(b).map((s) => s.text).join(""))
              .join(" "),
          )
          .join("    |    ");
        out.push({
          spans: [{ text: cellText, bold: false, italic: false }],
          size: baseSize - 1,
          indent,
          spaceBefore: baseSize * 0.3,
          mono: true,
        });
      }
      break;
    default:
      if (node.content) emitParagraph(node, baseSize, baseSize * 0.6);
      break;
  }
  return out;
}

/**
 * Lay out a whole document into a flat list of typeset lines.
 */
export function layoutDocument(
  doc: DocumentJSON,
  options: LayoutOptions,
  measure: MeasureText,
): TypesetLine[] {
  const opts: Required<LayoutOptions> = {
    contentWidth: options.contentWidth,
    baseSize: options.baseSize ?? 11,
  };
  const out: TypesetLine[] = [];
  for (const block of doc.content ?? []) {
    out.push(...layoutBlock(block, opts, measure, 0));
  }
  return out;
}
