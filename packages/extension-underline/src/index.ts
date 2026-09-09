/**
 * @smeditor/extension-underline
 *
 * Renders to `<u>`; parses both `<u>` and the legacy CSS form
 * `<span style="text-decoration: underline">`. Shortcut: Mod-u.
 */

import type { Extension, EditorInstance } from "@smeditor/core";
import { toggleMarkInDoc } from "@smeditor/core";

export const UnderlineExtension: Extension = {
  name: "underline",
  marks: [
    {
      name: "underline",
      inclusive: true,
      toDOM: () => ["u", 0],
      parseDOM: [
        { tag: "u" },
        {
          // Catch <span style="text-decoration: underline"> from MS Word
          // / Google Docs paste. We don't try to be exhaustive — common
          // cases only.
          tag: "span",
          getAttrs: (el) => {
            const style = el.getAttribute("style") ?? "";
            return /text-decoration:\s*underline/i.test(style) ? null : false;
          },
        },
      ],
    },
  ],
  commands: {
    toggleUnderline:
      () =>
      (editor: EditorInstance): boolean => {
        const next = toggleMarkInDoc(
          editor.getJSON(),
          editor.getSelection(),
          "underline",
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
    "Mod-u": (editor) => {
      const fn = editor.commands.toggleUnderline;
      return typeof fn === "function" ? fn() : false;
    },
  },
};

export default UnderlineExtension;
