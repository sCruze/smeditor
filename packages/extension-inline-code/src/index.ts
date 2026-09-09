/**
 * @smeditor/extension-inline-code
 *
 * Inline `<code>` mark — short code spans inside paragraphs.
 * Distinct from `code_block`, which is a block-level node.
 *
 * Shortcut: `Mod-e` (the de-facto standard across editors).
 * Excludes other marks: when applied, marks like bold/italic/link
 * are removed because monospace code shouldn't be re-styled.
 */

import type { Extension, EditorInstance } from "@smeditor/core";
import { toggleMarkInDoc } from "@smeditor/core";

export const InlineCodeExtension: Extension = {
  name: "inline_code",
  marks: [
    {
      name: "code",
      inclusive: false,
      // TODO: once MarkSpec supports an `excludes` field in core,
      // declare ["bold", "italic", "underline", "strike", "link"] so
      // code spans automatically clear other styling.
      toDOM: () => ["code", 0],
      parseDOM: [{ tag: "code" }],
    },
  ],
  commands: {
    toggleCode:
      () =>
      (editor: EditorInstance): boolean => {
        const next = toggleMarkInDoc(
          editor.getJSON(),
          editor.getSelection(),
          "code",
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
    "Mod-e": (editor) => editor.commands.toggleCode?.() ?? false,
  },
};

export default InlineCodeExtension;
