/**
 * @smeditor/extension-bold
 *
 * Adds a "bold" mark to the schema, a `toggleBold` command, and the
 * Cmd/Ctrl-B keyboard shortcut.
 *
 * The HTML form is `<strong>` (semantic). On parse we also accept `<b>`
 * for paste compatibility from other editors and word processors.
 */

import type { Extension, EditorInstance } from "@smeditor/core";
import { toggleMarkInDoc } from "@smeditor/core";

export const BoldExtension: Extension = {
  name: "bold",
  marks: [
    {
      name: "bold",
      inclusive: true,
      toDOM: () => ["strong", 0],
      parseDOM: [
        { tag: "strong" },
        { tag: "b" },
      ],
    },
  ],
  commands: {
    toggleBold:
      () =>
      (editor: EditorInstance): boolean => {
        const next = toggleMarkInDoc(
          editor.getJSON(),
          editor.getSelection(),
          "bold",
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
    "Mod-b": (editor) => {
      const fn = editor.commands.toggleBold;
      return typeof fn === "function" ? fn() : false;
    },
  },
};

export default BoldExtension;
