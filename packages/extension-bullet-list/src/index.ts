/**
 * @smeditor/extension-bullet-list
 *
 * `<ul>` wrapper. Requires `@smeditor/extension-list-item` to be
 * loaded as well (StarterKit handles that for you).
 *
 * `toggleBulletList()` wraps the selected blocks. If they're already
 * inside a bullet list, it unwraps them.
 */

import type { Extension, EditorInstance } from "@smeditor/core";
import { toggleWrap, selectionInsideWrapper } from "@smeditor/core";

export const BulletListExtension: Extension = {
  name: "bullet_list",
  nodes: [
    {
      name: "bullet_list",
      group: "block",
      content: "list_item+",
      toDOM: () => ["ul", 0],
      parseDOM: [{ tag: "ul" }],
    },
  ],
  commands: {
    toggleBulletList:
      () =>
      (editor: EditorInstance): boolean => {
        const next = toggleWrap(
          editor.getJSON(),
          editor.getSelection(),
          "bullet_list",
          "list_item",
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
    "Mod-Shift-8": (editor) => {
      const fn = editor.commands.toggleBulletList;
      return typeof fn === "function" ? fn() : false;
    },
  },
};

export function isBulletListActive(editor: EditorInstance): boolean {
  return selectionInsideWrapper(
    editor.getJSON(),
    editor.getSelection(),
    "bullet_list",
  );
}

export default BulletListExtension;
