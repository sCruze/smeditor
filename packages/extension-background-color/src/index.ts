/**
 * @smeditor/extension-background-color
 *
 * Fills the area behind the selected text and keeps the text readable on
 * it: the text becomes white on dark fills and near-black on light ones
 * (or a colour chosen explicitly). Renders as
 *   `<span class="smeditor-fill" style="background-color: …; color: …">`.
 *
 * The class tells the text-colour mark that this span's `color` belongs
 * to the fill, so it isn't parsed as a separate text colour. Plain
 * `background-color` spans (older content, pastes) are still read; their
 * text gets the automatic contrast colour.
 *
 * Distinct from `highlight` (`<mark>`): highlight is a semantic marker
 * and doesn't touch the text colour.
 */

import type { Extension, EditorInstance } from "@smeditor/core";
import {
  contrastTextColor,
  sanitizeCSSColor,
  setMarkAcrossSelection,
  unsetMarkAcrossSelection,
} from "@smeditor/core";

export const FILL_CLASS = "smeditor-fill";
/** Class used for filled text by 0.3.2 of the Rails adapter; read as a fill. */
const LEGACY_FILL_CLASSES = [FILL_CLASS, "smeditor-text-outline"];

/** True when an element is a fill span rendered by this extension. */
export function isFillElement(el: { getAttribute(name: string): string | null }): boolean {
  const classes = (el.getAttribute("class") ?? "").split(/\s+/);
  return LEGACY_FILL_CLASSES.some((name) => classes.includes(name));
}

function declaration(style: string, name: string): string | null {
  const m = new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`, "i").exec(style);
  return m ? m[1].trim() : null;
}

export const BackgroundColorExtension: Extension = {
  name: "background_color",
  marks: [
    {
      name: "background_color",
      inclusive: true,
      attrs: { color: { default: null }, textColor: { default: null } },
      toDOM: (mark) => {
        const color = sanitizeCSSColor(mark.attrs?.color);
        if (!color) return ["span", 0];
        const text = sanitizeCSSColor(mark.attrs?.textColor) ?? contrastTextColor(color);
        return ["span", { class: FILL_CLASS, style: `background-color: ${color}; color: ${text}` }, 0];
      },
      parseDOM: [
        {
          tag: "*",
          getAttrs: (el) => {
            if (el.tagName.toLowerCase() === "mark") return false;
            const style = el.getAttribute("style") ?? "";
            const color = sanitizeCSSColor(declaration(style, "background(?:-color)?"));
            if (!color) return false;
            const text = isFillElement(el) ? sanitizeCSSColor(declaration(style, "color")) : null;
            return { color, textColor: text ?? contrastTextColor(color) };
          },
        },
      ],
    },
  ],
  commands: {
    /**
     * setBackgroundColor({ color, textColor? }) — fills the selected text.
     * The text becomes `textColor`, or white / near-black automatically
     * for contrast; any text colour or highlight on the range is removed
     * so nothing paints over the fill.
     */
    setBackgroundColor:
      (opts: { color: string; textColor?: string | null }) =>
      (editor: EditorInstance): boolean => {
        const color = sanitizeCSSColor(opts?.color);
        if (!color) return false;
        const textColor = sanitizeCSSColor(opts?.textColor) ?? contrastTextColor(color);
        const selection = editor.getSelection();
        const cleared = ["text_color", "highlight"].reduce(
          (doc, mark) => unsetMarkAcrossSelection(doc, selection, mark) ?? doc,
          editor.getJSON(),
        );
        const next = setMarkAcrossSelection(cleared, selection, {
          type: "background_color",
          attrs: { color, textColor },
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
