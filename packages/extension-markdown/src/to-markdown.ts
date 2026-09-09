/**
 * Markdown serialization — `DocumentJSON` → Markdown text.
 *
 * Covers the export side of §16. A pure function: document in,
 * string out, no DOM, no editor.
 *
 * Scope: the common CommonMark constructs plus GitHub tables and
 * strikethrough. Constructs Markdown can't express (text / background
 * color, font, sub/sup, highlight, indent, line height, cell merges)
 * degrade gracefully — the text survives, the styling is dropped.
 */

import type { DocumentJSON, DocumentNode } from "@smeditor/core";

// ============================================================================
// Inline
// ============================================================================

/** Escape characters that would otherwise be Markdown syntax. */
/**
 * Escape characters that would otherwise be Markdown syntax.
 *
 * `.` and `!` are deliberately *not* escaped: a period is only
 * syntactic as part of an ordered-list marker (`1.` at the start of a
 * line) and `!` only before a `[` (image). Escaping every occurrence
 * would litter ordinary prose with backslashes. The rare cost is that
 * a paragraph whose text literally starts with `1. ` re-parses as a
 * list on import.
 */
function escapeText(text: string): string {
  return text.replace(/([\\`*_{}\[\]()#+\-~|])/g, "\\$1");
}

/**
 * Serialize one inline node. Marks are applied innermost-first;
 * `code` wins outright because Markdown can't format inside a code
 * span.
 */
function inlineToMarkdown(node: DocumentNode): string {
  if (node.type === "hard_break") return "  \n";
  if (node.type === "image") {
    const alt = String(node.attrs?.alt ?? "");
    const src = String(node.attrs?.src ?? "");
    return `![${alt}](${src})`;
  }
  if (node.type !== "text") return "";

  let text = node.text ?? "";
  const marks = node.marks ?? [];
  const has = (t: string) => marks.some((m) => m.type === t);

  // Code span — content is literal, no nested formatting.
  if (has("code")) {
    return `\`${text}\``;
  }

  text = escapeText(text);
  if (has("strike")) text = `~~${text}~~`;
  // Bold + italic combine as ***…***.
  if (has("bold") && has("italic")) text = `***${text}***`;
  else if (has("bold")) text = `**${text}**`;
  else if (has("italic")) text = `*${text}*`;

  const link = marks.find((m) => m.type === "link");
  if (link) {
    const href = String(link.attrs?.href ?? "");
    text = `[${text}](${href})`;
  }
  return text;
}

function inlineContent(node: DocumentNode): string {
  if (!node.content) return "";
  return node.content.map(inlineToMarkdown).join("");
}

/** Plain text of a node tree — used for code blocks and table cells. */
function plainText(node: DocumentNode): string {
  if (node.type === "text") return node.text ?? "";
  if (!node.content) return "";
  return node.content.map(plainText).join("");
}

// ============================================================================
// Blocks
// ============================================================================

function listToMarkdown(node: DocumentNode, ordered: boolean): string {
  const items = node.content ?? [];
  return items
    .map((item, i) => {
      const marker = ordered ? `${i + 1}.` : "-";
      // An item's blocks; first line gets the marker, the rest are
      // indented to line up under it.
      const body = (item.content ?? [])
        .map((b) => blockToMarkdown(b))
        .join("\n\n");
      const lines = body.split("\n");
      return lines
        .map((line, li) =>
          li === 0 ? `${marker} ${line}` : `   ${line}`,
        )
        .join("\n");
    })
    .join("\n");
}

function tableToMarkdown(node: DocumentNode): string {
  const rows = node.content ?? [];
  if (rows.length === 0) return "";
  const cellText = (cell: DocumentNode) =>
    (cell.content ?? [])
      .map((b) => inlineContent(b))
      .join(" ")
      .replace(/\|/g, "\\|")
      .trim();

  const matrix = rows.map((row) => (row.content ?? []).map(cellText));
  const cols = Math.max(...matrix.map((r) => r.length), 1);
  const pad = (r: string[]) => {
    const copy = [...r];
    while (copy.length < cols) copy.push("");
    return copy;
  };

  const out: string[] = [];
  const header = pad(matrix[0]);
  out.push(`| ${header.join(" | ")} |`);
  out.push(`| ${header.map(() => "---").join(" | ")} |`);
  for (let i = 1; i < matrix.length; i++) {
    out.push(`| ${pad(matrix[i]).join(" | ")} |`);
  }
  return out.join("\n");
}

function blockToMarkdown(node: DocumentNode): string {
  switch (node.type) {
    case "paragraph":
      return inlineContent(node);
    case "heading": {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level ?? 1)));
      return `${"#".repeat(level)} ${inlineContent(node)}`;
    }
    case "blockquote":
      return (node.content ?? [])
        .map((b) => blockToMarkdown(b))
        .join("\n\n")
        .split("\n")
        .map((line) => (line ? `> ${line}` : ">"))
        .join("\n");
    case "code_block":
      return `\`\`\`\n${plainText(node)}\n\`\`\``;
    case "horizontal_rule":
      return "---";
    case "bullet_list":
      return listToMarkdown(node, false);
    case "ordered_list":
      return listToMarkdown(node, true);
    case "task_list":
      // Render task items as a GitHub task list.
      return (node.content ?? [])
        .map((item) => {
          const checked = item.attrs?.checked ? "x" : " ";
          const body = (item.content ?? [])
            .map((b) => inlineContent(b))
            .join(" ");
          return `- [${checked}] ${body}`;
        })
        .join("\n");
    case "image":
      return `![${String(node.attrs?.alt ?? "")}](${String(node.attrs?.src ?? "")})`;
    case "table":
      return tableToMarkdown(node);
    default:
      // Unknown block — fall back to its text content.
      return inlineContent(node);
  }
}

// ============================================================================
// Entry point
// ============================================================================

/**
 * Serialize a SMEditor document to a Markdown string.
 */
export function toMarkdown(doc: DocumentJSON): string {
  const blocks = doc.content ?? [];
  const body = blocks
    .map((b) => blockToMarkdown(b))
    .filter((s) => s.length > 0)
    .join("\n\n");
  return body ? `${body}\n` : "";
}
