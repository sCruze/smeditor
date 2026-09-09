/**
 * @smeditor/extension-text-color
 *
 * A mark that carries a CSS color. Renders as `<span style="color:…">`.
 *
 * Security: accepts only colors that look like a valid CSS color token
 * (hex, rgb/rgba, hsl/hsla, or a named keyword). Anything else is
 * rejected at parse time so `style` can't become an injection vector.
 */

import type { Extension, EditorInstance } from "@smeditor/core";
import {
  sanitizeCSSColor,
  setMarkAcrossSelection,
  unsetMarkAcrossSelection,
} from "@smeditor/core";

export const TextColorExtension: Extension = {
  name: "text_color",
  marks: [
    {
      name: "text_color",
      inclusive: true,
      attrs: { color: { default: null } },
      toDOM: (mark) => {
        const color = sanitizeCSSColor(mark.attrs?.color);
        return color ? ["span", { style: `color: ${color}` }, 0] : ["span", 0];
      },
      parseDOM: [
        {
          tag: "*",
          getAttrs: (el) => {
            const style = el.getAttribute("style") ?? "";
            // Match `color:` only at the start of a declaration so a
            // `background-color:` declaration is never mistaken for it.
            const m = /(?:^|;)\s*color\s*:\s*([^;]+)/i.exec(style);
            if (!m) return false;
            const color = sanitizeCSSColor(m[1]);
            return color ? { color } : false;
          },
        },
      ],
    },
  ],
  commands: {
    /**
     * setTextColor({ color }) — colours exactly the selected text.
     * With a collapsed caret the whole block is coloured, so a
     * toolbar click still does something. Replaces any existing
     * colour on the range instead of stacking a second one.
     */
    setTextColor:
      (opts: { color: string }) =>
      (editor: EditorInstance): boolean => {
        const color = sanitizeCSSColor(opts?.color);
        if (!color) return false;
        const selection = editor.getSelection();
        const next = setMarkAcrossSelection(editor.getJSON(), selection, {
          type: "text_color",
          attrs: { color },
        });
        if (!next) return false;
        editor.dispatch({ doc: next, selection, addToHistory: true });
        return true;
      },
    unsetTextColor:
      () =>
      (editor: EditorInstance): boolean => {
        const selection = editor.getSelection();
        const next = unsetMarkAcrossSelection(
          editor.getJSON(),
          selection,
          "text_color",
        );
        if (!next) return false;
        editor.dispatch({ doc: next, selection, addToHistory: true });
        return true;
      },
  },
};

export default TextColorExtension;
