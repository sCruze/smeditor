/**
 * @smeditor/extension-highlight
 *
 * Background-color highlighter mark. Renders as `<mark>` (semantic).
 * Optional `color` attr — when set, becomes
 * `<mark style="background-color: COLOR">`. When unset, plain `<mark>`
 * inherits the browser's default yellow.
 *
 * Security: only safe-looking CSS color tokens are accepted (hex,
 * rgb/rgba, hsl/hsla, named keywords). Anything else is rejected at
 * parse time so `style` can't become an injection vector.
 */

import type { Extension, EditorInstance } from "@smeditor/core";
import {
  sanitizeCSSColor,
  toggleMarkInDoc,
  setMarkAcrossSelection,
  unsetMarkAcrossSelection,
} from "@smeditor/core";

export const HighlightExtension: Extension = {
  name: "highlight",
  marks: [
    {
      name: "highlight",
      inclusive: true,
      attrs: { color: { default: null } },
      toDOM: (mark) => {
        const color = sanitizeCSSColor(mark.attrs?.color);
        return color
          ? ["mark", { style: `background-color: ${color}` }, 0]
          : ["mark", 0];
      },
      parseDOM: [
        {
          tag: "mark",
          getAttrs: (el) => {
            const style = el.getAttribute("style") ?? "";
            const m = /background(?:-color)?\s*:\s*([^;]+)/i.exec(style);
            if (!m) return null;
            const color = sanitizeCSSColor(m[1]);
            return color ? { color } : false;
          },
        },
      ],
    },
  ],
  commands: {
    /**
     * setHighlight({ color }) — highlights the selected text. With a
     * colour it applies (and replaces) a coloured highlight on just
     * the selected range; without one it toggles a plain `<mark>`.
     */
    setHighlight:
      (opts: { color?: string } = {}) =>
      (editor: EditorInstance): boolean => {
        const color = opts.color ? sanitizeCSSColor(opts.color) : null;
        const selection = editor.getSelection();
        if (!selection) return false;

        if (color) {
          const next = setMarkAcrossSelection(editor.getJSON(), selection, {
            type: "highlight",
            attrs: { color },
          });
          if (!next) return false;
          editor.dispatch({ doc: next, selection, addToHistory: true });
          return true;
        }
        const next = toggleMarkInDoc(
          editor.getJSON(),
          selection,
          "highlight",
        );
        if (!next) return false;
        editor.dispatch({ doc: next, selection, addToHistory: true });
        return true;
      },
    /** Remove the highlight mark from the selection. */
    unsetHighlight:
      () =>
      (editor: EditorInstance): boolean => {
        const selection = editor.getSelection();
        const next = unsetMarkAcrossSelection(
          editor.getJSON(),
          selection,
          "highlight",
        );
        if (!next) return false;
        editor.dispatch({ doc: next, selection, addToHistory: true });
        return true;
      },
  },
  keyboardShortcuts: {
    "Mod-Shift-h": (editor) => editor.commands.setHighlight?.() ?? false,
  },
};

export default HighlightExtension;
