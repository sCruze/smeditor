/**
 * @smeditor/export-docx — OOXML generation
 *
 * Turns a SMEditor JSON document into the body XML of a Word
 * `.docx` (the `word/document.xml` part). This module is pure — it
 * produces strings and has no dependency on the zip layer — so the
 * mapping is fully unit-testable on its own.
 *
 * Supported nodes: paragraph, heading, blockquote, code_block,
 * bullet_list / ordered_list (as styled paragraphs), horizontal_rule,
 * hard_break, and table. Supported marks: bold, italic, underline,
 * strike, inline code, subscript, superscript.
 */

import type { DocumentJSON, DocumentNode } from "@smeditor/core";
import { isContainerBlock } from "@smeditor/core";

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

/** Escape text for use inside an XML element. */
function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ----------------------------------------------------------------------------
// Inline runs
// ----------------------------------------------------------------------------

/** Build the `<w:rPr>` run-properties for a text node's marks. */
function runProps(node: DocumentNode): string {
  const marks = node.marks ?? [];
  const props: string[] = [];
  for (const m of marks) {
    switch (m.type) {
      case "bold":
        props.push("<w:b/>");
        break;
      case "italic":
        props.push("<w:i/>");
        break;
      case "underline":
        props.push('<w:u w:val="single"/>');
        break;
      case "strike":
        props.push("<w:strike/>");
        break;
      case "inline_code":
      case "code":
        props.push('<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>');
        break;
      case "subscript":
        props.push('<w:vertAlign w:val="subscript"/>');
        break;
      case "superscript":
        props.push('<w:vertAlign w:val="superscript"/>');
        break;
      case "text_color": {
        const c = String(m.attrs?.color ?? "").replace("#", "");
        if (c) props.push(`<w:color w:val="${c}"/>`);
        break;
      }
      case "highlight":
        props.push('<w:highlight w:val="yellow"/>');
        break;
      default:
        break;
    }
  }
  return props.length ? `<w:rPr>${props.join("")}</w:rPr>` : "";
}

/** Render one inline node (text or hard_break) as a `<w:r>` run. */
function inlineToRun(node: DocumentNode): string {
  if (node.type === "hard_break") {
    return "<w:r><w:br/></w:r>";
  }
  if (node.type === "text") {
    const text = escapeXml(node.text ?? "");
    return `<w:r>${runProps(node)}<w:t xml:space="preserve">${text}</w:t></w:r>`;
  }
  // image / mention / other inline atoms — fall back to their text.
  const fallback = escapeXml(node.text ?? "");
  return fallback
    ? `<w:r><w:t xml:space="preserve">${fallback}</w:t></w:r>`
    : "";
}

/** Render a block's inline content as a sequence of runs. */
function inlineContent(node: DocumentNode): string {
  return (node.content ?? []).map(inlineToRun).join("");
}

// ----------------------------------------------------------------------------
// Block nodes
// ----------------------------------------------------------------------------

/** A `<w:p>` paragraph, optionally carrying a paragraph style. */
function paragraph(node: DocumentNode, style?: string): string {
  const parts: string[] = [];
  if (style) parts.push(`<w:pStyle w:val="${style}"/>`);
  const align = node.attrs?.textAlign as string | undefined;
  if (align && align !== "left") {
    const val = align === "justify" ? "both" : align;
    parts.push(`<w:jc w:val="${val}"/>`);
  }
  const pPr = parts.length ? `<w:pPr>${parts.join("")}</w:pPr>` : "";
  return `<w:p>${pPr}${inlineContent(node)}</w:p>`;
}

/** List items rendered as paragraphs with a list-paragraph style. */
function listParagraphs(node: DocumentNode, ordered: boolean): string {
  const items = node.content ?? [];
  return items
    .map((item, i) => {
      const marker = ordered ? `${i + 1}. ` : "\u2022 ";
      // Prefix the marker onto the first leaf block of the item.
      const leaves = item.content ?? [];
      return leaves
        .map((leaf, li) => {
          // A nested list (or other container block) recurses through
          // blockToXml so its own list items are rendered; the marker
          // prefix is only for inline-bearing leaf blocks.
          if (isContainerBlock(leaf)) {
            return blockToXml(leaf);
          }
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
          return paragraph(prefixed, "ListParagraph");
        })
        .join("");
    })
    .join("");
}

/** A `<w:tbl>` table. */
function table(node: DocumentNode): string {
  const rows = (node.content ?? [])
    .map((row) => {
      const cells = (row.content ?? [])
        .map((cell) => {
          const blocks = (cell.content ?? [])
            .map(blockToXml)
            .join("");
          const body = blocks || "<w:p/>";
          return `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/></w:tcPr>${body}</w:tc>`;
        })
        .join("");
      return `<w:tr>${cells}</w:tr>`;
    })
    .join("");
  const props =
    "<w:tblPr><w:tblBorders>" +
    ["top", "left", "bottom", "right", "insideH", "insideV"]
      .map((s) => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="auto"/>`)
      .join("") +
    "</w:tblBorders></w:tblPr>";
  return `<w:tbl>${props}${rows}</w:tbl>`;
}

/** Render one block node as OOXML. */
function blockToXml(node: DocumentNode): string {
  switch (node.type) {
    case "paragraph":
      return paragraph(node);
    case "heading": {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level ?? 1)));
      return paragraph(node, `Heading${level}`);
    }
    case "blockquote":
      return (node.content ?? [])
        .map((child) =>
          child.type === "paragraph"
            ? paragraph(child, "Quote")
            : blockToXml(child),
        )
        .join("");
    case "code_block":
      return paragraph(node, "Code");
    case "bullet_list":
      return listParagraphs(node, false);
    case "ordered_list":
      return listParagraphs(node, true);
    case "task_list":
      return listParagraphs(node, false);
    case "horizontal_rule":
      return "<w:p><w:pPr><w:pBdr><w:bottom w:val=\"single\" w:sz=\"6\" w:space=\"1\" w:color=\"auto\"/></w:pBdr></w:pPr></w:p>";
    case "table":
      // A table must be followed by a paragraph in OOXML.
      return table(node) + "<w:p/>";
    default:
      // Unknown block — emit its inline content as a paragraph.
      return node.content ? paragraph(node) : "";
  }
}

/**
 * Build the full `word/document.xml` for a SMEditor document.
 */
export function documentXml(doc: DocumentJSON): string {
  const body = (doc.content ?? []).map(blockToXml).join("");
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<w:document ${W}>` +
    `<w:body>${body}<w:sectPr/></w:body>` +
    "</w:document>"
  );
}
