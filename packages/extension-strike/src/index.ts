/**
 * @smeditor/extension-strike
 *
 * Strike-through mark. Renders to `<s>`; parses `<s>`, `<del>`,
 * `<strike>` (the obsolete HTML4 element), and inline
 * `text-decoration: line-through`. Shortcut: Mod-Shift-S.
 */

import type { Extension, EditorInstance } from "@smeditor/core";
import { toggleMarkInDoc } from "@smeditor/core";

export const StrikeExtension: Extension = {
  name: "strike",
  marks: [
    {
      name: "strike",
      // Innermost, so the line takes the colour of the text it crosses.
      rank: 2,
      inclusive: true,
      toDOM: () => ["s", 0],
      parseDOM: [
        { tag: "s" },
        { tag: "del" },
        { tag: "strike" },
        {
          tag: "span",
          getAttrs: (el) => {
            const style = el.getAttribute("style") ?? "";
            return /text-decoration:\s*line-through/i.test(style) ? null : false;
          },
        },
      ],
    },
  ],
  commands: {
    toggleStrike:
      () =>
      (editor: EditorInstance): boolean => {
        const next = toggleMarkInDoc(
          editor.getJSON(),
          editor.getSelection(),
          "strike",
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
    "Mod-Shift-s": (editor) => {
      const fn = editor.commands.toggleStrike;
      return typeof fn === "function" ? fn() : false;
    },
  },
};

export default StrikeExtension;
