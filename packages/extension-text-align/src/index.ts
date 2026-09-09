/**
 * @smeditor/extension-text-align
 *
 * Sets a `textAlign` attribute on the block(s) under the selection.
 * Works with paragraph, heading, blockquote — any block that opts in
 * by accepting a `textAlign` attribute on its NodeSpec.
 *
 * Updated paragraph and heading extensions in this iteration declare
 * the attribute, and their `toDOM` emits `style="text-align: …"` so
 * the alignment survives the HTML round-trip without needing a custom
 * serializer.
 *
 * Allowed values: "left", "center", "right", "justify". An empty
 * value (or `setTextAlign(null)`) clears the attribute.
 */

import type {
  Extension,
  EditorInstance,
  DocumentJSON,
  DocumentNode,
} from "@smeditor/core";
import { cloneDoc, leafBlocksInSelection } from "@smeditor/core";

export type TextAlign = "left" | "center" | "right" | "justify";

const VALID: ReadonlySet<TextAlign> = new Set([
  "left",
  "center",
  "right",
  "justify",
]);

export const TextAlignExtension: Extension = {
  name: "text_align",
  commands: {
    /**
     * setTextAlign({ align: "center" }) — applies to every block the
     * selection touches. Pass `{ align: null }` to clear.
     */
    setTextAlign:
      (params: { align: TextAlign | null }) =>
      (editor: EditorInstance): boolean => {
        const selection = editor.getSelection();
        if (!selection) return false;

        const align = params?.align ?? null;
        if (align !== null && !VALID.has(align)) return false;

        const doc: DocumentJSON = cloneDoc(editor.getJSON());
        // Resolve through leafBlocksInSelection so a deep selection
        // aligns the leaf blocks inside table cells, not just the top
        // level.
        const leaves = leafBlocksInSelection(doc, selection);
        if (leaves.length === 0) return false;
        let changed = false;
        for (const { node: block } of leaves) {
          const currentAlign = (block.attrs?.textAlign ?? null) as
            | TextAlign
            | null;
          if (currentAlign === align) continue;
          if (align === null) {
            if (block.attrs) {
              const { textAlign, ...rest } = block.attrs;
              if (Object.keys(rest).length === 0) delete block.attrs;
              else block.attrs = rest;
            }
          } else {
            block.attrs = { ...(block.attrs ?? {}), textAlign: align };
          }
          changed = true;
        }
        if (!changed) return false;
        editor.dispatch({
          doc,
          selection,
          addToHistory: true,
        });
        return true;
      },
  },
  keyboardShortcuts: {
    "Mod-Shift-l": (editor) =>
      editor.commands.setTextAlign?.({ align: "left" }) ?? false,
    "Mod-Shift-e": (editor) =>
      editor.commands.setTextAlign?.({ align: "center" }) ?? false,
    "Mod-Shift-r": (editor) =>
      editor.commands.setTextAlign?.({ align: "right" }) ?? false,
    "Mod-Shift-j": (editor) =>
      editor.commands.setTextAlign?.({ align: "justify" }) ?? false,
  },
};

/**
 * Helper for toolbar buttons. Walks the selection path so a quote /
 * cell / list item resolves to the leaf paragraph and the dropdown
 * shows the right active state inside containers.
 */
export function isTextAlignActive(
  editor: EditorInstance,
  align: TextAlign,
): boolean {
  const sel = editor.getSelection();
  if (!sel) return false;
  let node: DocumentNode = editor.getJSON();
  let leaf: DocumentNode | null = null;
  for (const idx of sel.anchor.path) {
    const child = node.content?.[idx];
    if (!child) break;
    leaf = child;
    node = child;
  }
  const current = (leaf?.attrs?.textAlign ?? "left") as TextAlign;
  return current === align;
}

export default TextAlignExtension;
