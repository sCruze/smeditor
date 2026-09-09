/**
 * @smeditor/extension-subscript
 *
 * Subscript text — `<sub>`. Mutually exclusive with superscript:
 * the two extensions list each other in `excludes`, so toggling
 * subscript removes any existing superscript on the same span.
 *
 * Shortcut: Mod-, (matches Google Docs).
 */

import type { Extension, EditorInstance } from "@smeditor/core";
import { toggleMarkInDoc } from "@smeditor/core";

export const SubscriptExtension: Extension = {
  name: "subscript",
  marks: [
    {
      name: "subscript",
      inclusive: true,
      // TODO: declare excludes: ["superscript"] once MarkSpec supports it
      toDOM: () => ["sub", 0],
      parseDOM: [
        { tag: "sub" },
        {
          tag: "span",
          getAttrs: (el) => {
            const style = el.getAttribute("style") ?? "";
            return /vertical-align:\s*sub/i.test(style) ? null : false;
          },
        },
      ],
    },
  ],
  commands: {
    toggleSubscript:
      () =>
      (editor: EditorInstance): boolean => {
        const next = toggleMarkInDoc(
          editor.getJSON(),
          editor.getSelection(),
          "subscript",
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
    "Mod-,": (editor) => editor.commands.toggleSubscript?.() ?? false,
  },
};

export default SubscriptExtension;
