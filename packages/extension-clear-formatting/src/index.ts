/**
 * @smeditor/extension-clear-formatting
 *
 * The "eraser" button. Strips every mark from the text inside the
 * selected range (or the whole block, when the caret is collapsed),
 * reaching into table cells / list items / blockquotes through the
 * deep selection path. Does **not** touch block types — call
 * `setParagraph` separately if you also want to reset the block.
 */

import type { Extension, EditorInstance } from "@smeditor/core";
import { clearMarksAcrossSelection } from "@smeditor/core";

export const ClearFormattingExtension: Extension = {
  name: "clear_formatting",
  commands: {
    clearFormatting:
      () =>
      (editor: EditorInstance): boolean => {
        const selection = editor.getSelection();
        const next = clearMarksAcrossSelection(editor.getJSON(), selection);
        if (!next) return false;
        editor.dispatch({ doc: next, selection, addToHistory: true });
        return true;
      },
  },
  keyboardShortcuts: {
    "Mod-\\": (editor) => editor.commands.clearFormatting?.() ?? false,
  },
};

export default ClearFormattingExtension;
