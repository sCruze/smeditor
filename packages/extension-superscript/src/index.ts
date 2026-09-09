/**
 * @smeditor/extension-superscript
 *
 * Superscript text — `<sup>`. Mutually exclusive with subscript.
 * Shortcut: Mod-. (matches Google Docs).
 */

import type { Extension, EditorInstance } from "@smeditor/core";
import { toggleMarkInDoc } from "@smeditor/core";

export const SuperscriptExtension: Extension = {
  name: "superscript",
  marks: [
    {
      name: "superscript",
      inclusive: true,
      // TODO: declare excludes: ["subscript"] once MarkSpec supports it
      toDOM: () => ["sup", 0],
      parseDOM: [
        { tag: "sup" },
        {
          tag: "span",
          getAttrs: (el) => {
            const style = el.getAttribute("style") ?? "";
            return /vertical-align:\s*super/i.test(style) ? null : false;
          },
        },
      ],
    },
  ],
  commands: {
    toggleSuperscript:
      () =>
      (editor: EditorInstance): boolean => {
        const next = toggleMarkInDoc(
          editor.getJSON(),
          editor.getSelection(),
          "superscript",
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
    "Mod-.": (editor) => editor.commands.toggleSuperscript?.() ?? false,
  },
};

export default SuperscriptExtension;
