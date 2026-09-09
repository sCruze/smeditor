/**
 * @smeditor/extension-font-size
 *
 * A mark carrying a CSS `font-size`. Renders as
 * `<span style="font-size: …">`.
 *
 * Accepted values: a number followed by a CSS length unit
 * (`px`, `pt`, `em`, `rem`, `%`). Bare numbers are treated as `px`.
 * Anything else is rejected.
 */

import type { Extension, EditorInstance } from "@smeditor/core";
import { setMarkAcrossSelection, unsetMarkAcrossSelection } from "@smeditor/core";

const FONT_SIZE_TOKEN = /^(\d+(?:\.\d+)?)(px|pt|em|rem|%)?$/;

function sanitizeSize(raw: string): string | null {
  const t = String(raw).trim();
  const m = FONT_SIZE_TOKEN.exec(t);
  if (!m) return null;
  const value = Number(m[1]);
  if (!Number.isFinite(value) || value <= 0 || value > 400) return null;
  const unit = m[2] ?? "px";
  return `${m[1]}${unit}`;
}

export const FontSizeExtension: Extension = {
  name: "font_size",
  marks: [
    {
      name: "font_size",
      inclusive: true,
      attrs: { size: { default: null } },
      toDOM: (mark) => {
        const size = sanitizeSize(String(mark.attrs?.size ?? ""));
        return size
          ? ["span", { style: `font-size: ${size}` }, 0]
          : ["span", 0];
      },
      parseDOM: [
        {
          tag: "*",
          getAttrs: (el) => {
            const style = el.getAttribute("style") ?? "";
            const m = /font-size\s*:\s*([^;]+)/i.exec(style);
            if (!m) return false;
            const size = sanitizeSize(m[1]);
            return size ? { size } : false;
          },
        },
      ],
    },
  ],
  commands: {
    /** setFontSize({ size }) — applies to the selected range. */
    setFontSize:
      (opts: { size: string | number }) =>
      (editor: EditorInstance): boolean => {
        const size = sanitizeSize(String(opts?.size ?? ""));
        if (!size) return false;
        const selection = editor.getSelection();
        const next = setMarkAcrossSelection(editor.getJSON(), selection, {
          type: "font_size",
          attrs: { size },
        });
        if (!next) return false;
        editor.dispatch({ doc: next, selection, addToHistory: true });
        return true;
      },
    unsetFontSize:
      () =>
      (editor: EditorInstance): boolean => {
        const selection = editor.getSelection();
        const next = unsetMarkAcrossSelection(
          editor.getJSON(),
          selection,
          "font_size",
        );
        if (!next) return false;
        editor.dispatch({ doc: next, selection, addToHistory: true });
        return true;
      },
  },
};

export default FontSizeExtension;
