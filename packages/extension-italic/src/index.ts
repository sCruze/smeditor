/**
 * @smeditor/extension-italic
 *
 * Renders to `<em>`; parses both `<em>` and `<i>`.
 */

import type { Extension, EditorInstance } from "@smeditor/core";
import { toggleMarkInDoc } from "@smeditor/core";

export const ItalicExtension: Extension = {
  name: "italic",
  marks: [
    {
      name: "italic",
      inclusive: true,
      toDOM: () => ["em", 0],
      parseDOM: [
        { tag: "em" },
        { tag: "i" },
      ],
    },
  ],
  commands: {
    toggleItalic:
      () =>
      (editor: EditorInstance): boolean => {
        const next = toggleMarkInDoc(
          editor.getJSON(),
          editor.getSelection(),
          "italic",
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
    "Mod-i": (editor) => {
      const fn = editor.commands.toggleItalic;
      return typeof fn === "function" ? fn() : false;
    },
  },
};

export default ItalicExtension;
