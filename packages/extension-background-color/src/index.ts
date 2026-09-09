/**
 * @smeditor/extension-background-color
 *
 * Inline background color — `<span style="background-color: …">`.
 * Distinct from `highlight` (`<mark>`): highlight is semantic, this
 * is purely cosmetic so it doesn't render with `<mark>`'s default
 * yellow.
 */

import type { Extension, EditorInstance } from "@smeditor/core";
import {
  sanitizeCSSColor,
  setMarkAcrossSelection,
  unsetMarkAcrossSelection,
} from "@smeditor/core";

export const BackgroundColorExtension: Extension = {
  name: "background_color",
  marks: [
    {
      name: "background_color",
      inclusive: true,
      attrs: { color: { default: null } },
      toDOM: (mark) => {
        const color = sanitizeCSSColor(mark.attrs?.color);
        return color
          ? ["span", { style: `background-color: ${color}` }, 0]
          : ["span", 0];
      },
      parseDOM: [
        {
          tag: "*",
          getAttrs: (el) => {
            if (el.tagName.toLowerCase() === "mark") return false;
            const style = el.getAttribute("style") ?? "";
            const m = /background(?:-color)?\s*:\s*([^;]+)/i.exec(style);
            if (!m) return false;
            const color = sanitizeCSSColor(m[1]);
            return color ? { color } : false;
          },
        },
      ],
    },
  ],
  commands: {
    /** setBackgroundColor({ color }) — applies to the selected range. */
    setBackgroundColor:
      (opts: { color: string }) =>
      (editor: EditorInstance): boolean => {
        const color = sanitizeCSSColor(opts?.color);
        if (!color) return false;
        const selection = editor.getSelection();
        const next = setMarkAcrossSelection(editor.getJSON(), selection, {
          type: "background_color",
          attrs: { color },
        });
        if (!next) return false;
        editor.dispatch({ doc: next, selection, addToHistory: true });
        return true;
      },
    unsetBackgroundColor:
      () =>
      (editor: EditorInstance): boolean => {
        const selection = editor.getSelection();
        const next = unsetMarkAcrossSelection(
          editor.getJSON(),
          selection,
          "background_color",
        );
        if (!next) return false;
        editor.dispatch({ doc: next, selection, addToHistory: true });
        return true;
      },
  },
};

export default BackgroundColorExtension;
