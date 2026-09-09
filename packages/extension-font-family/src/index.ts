/**
 * @smeditor/extension-font-family
 *
 * A mark carrying a CSS `font-family`. Renders as
 * `<span style="font-family: …">`.
 *
 * Security: the value is checked against a conservative pattern —
 * letters, digits, spaces, commas, hyphens and quotes only. Anything
 * with parens, semicolons or other CSS punctuation is rejected so the
 * `style` attribute can't be used as an injection vector.
 */

import type { Extension, EditorInstance } from "@smeditor/core";
import { setMarkAcrossSelection, unsetMarkAcrossSelection } from "@smeditor/core";

// Font stacks are letters / digits / spaces / commas / hyphens / quotes.
const FONT_FAMILY_TOKEN = /^[a-zA-Z0-9 ,"'-]+$/;

function sanitizeFamily(raw: string): string | null {
  const t = raw.trim();
  if (!t || t.length > 200) return null;
  return FONT_FAMILY_TOKEN.test(t) ? t : null;
}

export const FontFamilyExtension: Extension = {
  name: "font_family",
  marks: [
    {
      name: "font_family",
      inclusive: true,
      attrs: { family: { default: null } },
      toDOM: (mark) => {
        const family = sanitizeFamily(String(mark.attrs?.family ?? ""));
        return family
          ? ["span", { style: `font-family: ${family}` }, 0]
          : ["span", 0];
      },
      parseDOM: [
        {
          tag: "*",
          getAttrs: (el) => {
            const style = el.getAttribute("style") ?? "";
            const m = /font-family\s*:\s*([^;]+)/i.exec(style);
            if (!m) return false;
            const family = sanitizeFamily(m[1]);
            return family ? { family } : false;
          },
        },
      ],
    },
  ],
  commands: {
    /** setFontFamily({ family }) — applies to the selected range. */
    setFontFamily:
      (opts: { family: string }) =>
      (editor: EditorInstance): boolean => {
        const family = sanitizeFamily(opts?.family ?? "");
        if (!family) return false;
        const selection = editor.getSelection();
        const next = setMarkAcrossSelection(editor.getJSON(), selection, {
          type: "font_family",
          attrs: { family },
        });
        if (!next) return false;
        editor.dispatch({ doc: next, selection, addToHistory: true });
        return true;
      },
    unsetFontFamily:
      () =>
      (editor: EditorInstance): boolean => {
        const selection = editor.getSelection();
        const next = unsetMarkAcrossSelection(
          editor.getJSON(),
          selection,
          "font_family",
        );
        if (!next) return false;
        editor.dispatch({ doc: next, selection, addToHistory: true });
        return true;
      },
  },
};

export default FontFamilyExtension;
