/**
 * @smeditor/extension-hard-break
 *
 * Inline `<br/>` node. Without this extension, core's parser converts
 * `<br>` to a literal `\n` inside text (a soft break). With it,
 * `<br>` becomes a first-class inline node and survives round-trips.
 *
 * Keyboard: Shift-Enter inserts a hard break. Plain Enter is left
 * alone — that's the job of paragraph-splitting logic in a future
 * iteration.
 */

import type { Extension, EditorInstance } from "@smeditor/core";
import { cloneDoc, nodeAt, insertInlineAt } from "@smeditor/core";

export const HardBreakExtension: Extension = {
  name: "hard_break",
  nodes: [
    {
      name: "hard_break",
      group: "inline",
      content: "none",
      toDOM: () => ["br"],
      parseDOM: [{ tag: "br" }],
    },
  ],
  commands: {
    insertHardBreak:
      () =>
      (editor: EditorInstance): boolean => {
        const selection = editor.getSelection();
        if (!selection) return false;
        const doc = cloneDoc(editor.getJSON());
        const block = nodeAt(doc, selection.anchor.path);
        if (!block) return false;
        // Insert the break at the caret, splitting the inline run there,
        // instead of always appending at the end of the block (which put
        // every break in the wrong place and, being trailing, was then
        // dropped by the serializer on the next round-trip).
        block.content = insertInlineAt(
          block.content ?? [],
          selection.anchor.offset,
          [{ type: "hard_break" }],
        );
        editor.dispatch({
          doc,
          selection,
          addToHistory: true,
        });
        return true;
      },
  },
  keyboardShortcuts: {
    "Shift-Enter": (editor) => {
      const fn = editor.commands.insertHardBreak;
      return typeof fn === "function" ? fn() : false;
    },
  },
};

export default HardBreakExtension;
