/**
 * @smeditor/extension-horizontal-rule
 *
 * `<hr>` divider as a self-contained block node. The block has no
 * content, only a presence — its job is purely visual separation.
 *
 * Inserted with `editor.commands.insertHorizontalRule()`. Replaces
 * the current empty block, or inserts a new block after the current
 * one and an empty paragraph after that for the caret to land in.
 */

import type { Extension, EditorInstance, DocumentJSON } from "@smeditor/core";
import { cloneDoc } from "@smeditor/core";

export const HorizontalRuleExtension: Extension = {
  name: "horizontal_rule",
  nodes: [
    {
      name: "horizontal_rule",
      group: "block",
      content: "",
      // `atom` would be ideal here — caret can't enter the node — but
      // we don't currently have an atom flag in the NodeSpec; the
      // editor treats this gracefully because the node has no content
      // and we always insert a paragraph after it.
      toDOM: () => ["hr"],
      parseDOM: [{ tag: "hr" }],
    },
  ],
  commands: {
    insertHorizontalRule:
      () =>
      (editor: EditorInstance): boolean => {
        const sel = editor.getSelection();
        if (!sel) return false;
        const doc: DocumentJSON = cloneDoc(editor.getJSON());
        const idx = sel.anchor.path[0] ?? 0;

        const hr = { type: "horizontal_rule" } as const;
        const trailingParagraph = { type: "paragraph" } as const;

        const current = doc.content[idx];
        const currentIsEmpty =
          current &&
          (!current.content || current.content.length === 0 ||
            (current.content.length === 1 &&
              current.content[0].type === "text" &&
              (current.content[0].text ?? "") === ""));

        if (currentIsEmpty) {
          // Replace the empty block with hr + new paragraph.
          doc.content.splice(idx, 1, hr, trailingParagraph);
        } else {
          // Insert after the current block.
          doc.content.splice(idx + 1, 0, hr, trailingParagraph);
        }

        editor.dispatch({
          doc,
          selection: {
            anchor: { path: [idx + (currentIsEmpty ? 1 : 2)], offset: 0 },
            head: { path: [idx + (currentIsEmpty ? 1 : 2)], offset: 0 },
          },
          addToHistory: true,
        });
        return true;
      },
  },
};

export default HorizontalRuleExtension;
