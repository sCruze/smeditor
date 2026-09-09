/**
 * @smeditor/extension-paragraph
 *
 * The default block. Optional attributes, each set by its own
 * extension and harmless when that extension isn't loaded:
 *  - `textAlign`  — extension-text-align
 *  - `indent`     — extension-indent
 *  - `lineHeight` — extension-line-height
 */

import type {
  Extension,
  EditorInstance,
  DocumentNode,
  DOMOutputSpec,
} from "@smeditor/core";
import { setBlockType } from "@smeditor/core";

const ALIGN_VALUES = new Set(["left", "center", "right", "justify"]);

function buildAttrs(node: DocumentNode): Record<string, string> | null {
  const align = node.attrs?.textAlign;
  const indent = Number(node.attrs?.indent ?? 0);
  const lineHeight = node.attrs?.lineHeight;
  const styles: string[] = [];
  const out: Record<string, string> = {};
  if (typeof align === "string" && ALIGN_VALUES.has(align) && align !== "left") {
    styles.push(`text-align: ${align}`);
  }
  if (typeof lineHeight === "string" && lineHeight) {
    styles.push(`line-height: ${lineHeight}`);
  }
  if (indent > 0) {
    out["data-indent"] = String(indent);
  }
  if (styles.length) out.style = styles.join("; ");
  return Object.keys(out).length ? out : null;
}

function readAttrs(el: HTMLElement): Record<string, unknown> | null {
  const style = el.getAttribute("style") ?? "";
  const align = /text-align:\s*(left|center|right|justify)/i.exec(style);
  const lh = /line-height:\s*([^;]+)/i.exec(style);
  const indentRaw = el.getAttribute("data-indent");
  const indent = indentRaw ? Number(indentRaw) || null : null;
  const out: Record<string, unknown> = {};
  if (align) out.textAlign = align[1].toLowerCase();
  if (lh) out.lineHeight = lh[1].trim();
  if (indent) out.indent = indent;
  return Object.keys(out).length ? out : null;
}

function paragraphToDOM(node: DocumentNode): DOMOutputSpec {
  const attrs = buildAttrs(node);
  return attrs ? ["p", attrs, 0] : ["p", 0];
}

export const ParagraphExtension: Extension = {
  name: "paragraph",
  nodes: [
    {
      name: "paragraph",
      group: "block",
      content: "inline*",
      attrs: {
        textAlign: { default: null },
        indent: { default: null },
        lineHeight: { default: null },
      },
      toDOM: paragraphToDOM,
      parseDOM: [{ tag: "p", getAttrs: readAttrs }],
    },
  ],
  commands: {
    setParagraph:
      () =>
      (editor: EditorInstance): boolean => {
        const next = setBlockType(
          editor.getJSON(),
          editor.getSelection(),
          "paragraph",
        );
        if (!next) return false;
        editor.dispatch({
          doc: next,
          selection: editor.getSelection(),
          addToHistory: true,
        });
        return true;
      },
  },
};

export default ParagraphExtension;
