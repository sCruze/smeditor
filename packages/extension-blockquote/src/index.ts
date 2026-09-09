/**
 * @smeditor/extension-blockquote
 *
 * Wraps the selected block(s) in a <blockquote>. Toggleable: running
 * the command again on content already inside a blockquote unwraps it.
 */

import type { Extension, EditorInstance } from "@smeditor/core";
import { toggleWrap, selectionInsideWrapper } from "@smeditor/core";

export const BlockquoteExtension: Extension = {
  name: "blockquote",
  nodes: [
    {
      name: "blockquote",
      group: "block",
      content: "block+",
      toDOM: () => ["blockquote", 0],
      parseDOM: [{ tag: "blockquote" }],
    },
  ],
  commands: {
    toggleBlockquote:
      () =>
      (editor: EditorInstance): boolean => {
        const next = toggleWrap(
          editor.getJSON(),
          editor.getSelection(),
          "blockquote",
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
  keyboardShortcuts: {
    "Mod-Shift-b": (editor) => {
      const fn = editor.commands.toggleBlockquote;
      return typeof fn === "function" ? fn() : false;
    },
  },
};

/**
 * Helper for toolbar buttons: is the selection inside a blockquote?
 * (Re-exported so consumers don't need to import core directly.)
 */
export function isBlockquoteActive(editor: EditorInstance): boolean {
  return selectionInsideWrapper(
    editor.getJSON(),
    editor.getSelection(),
    "blockquote",
  );
}

export default BlockquoteExtension;
