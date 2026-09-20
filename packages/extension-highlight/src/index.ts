/**
 * @smeditor/extension-highlight
 *
 * Background-color highlighter mark. Renders as `<mark>` (semantic).
 * Optional `color` attr — when set, becomes
 * `<mark style="background-color: COLOR; color: TEXT">`, where TEXT keeps
 * the text readable on the highlight: white on dark colours, near-black
 * on light ones, or `textColor` when given. When unset, plain `<mark>`
 * uses the theme's default yellow.
 *
 * Security: only safe-looking CSS color tokens are accepted (hex,
 * rgb/rgba, hsl/hsla, named keywords). Anything else is rejected at
 * parse time so `style` can't become an injection vector.
 */

import type { Extension, EditorInstance } from "@smeditor/core";
import {
  contrastTextColor,
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
      attrs: { color: { default: null }, textColor: { default: null } },
      toDOM: (mark) => {
        const color = sanitizeCSSColor(mark.attrs?.color);
        if (!color) return ["mark", 0];
        const text = sanitizeCSSColor(mark.attrs?.textColor) ?? contrastTextColor(color);
        return ["mark", { style: `background-color: ${color}; color: ${text}` }, 0];
      },
      parseDOM: [
        {
          tag: "mark",
          getAttrs: (el) => {
            const style = el.getAttribute("style") ?? "";
            const m = /background(?:-color)?\s*:\s*([^;]+)/i.exec(style);
            if (!m) return null;
            const color = sanitizeCSSColor(m[1]);
            if (!color) return false;
            const text = /(?:^|;)\s*color\s*:\s*([^;]+)/i.exec(style);
            return { color, textColor: sanitizeCSSColor(text?.[1]?.trim()) ?? contrastTextColor(color) };
          },
        },
      ],
    },
  ],
  commands: {
    /**
     * setHighlight({ color, textColor? }) — highlights the selected text.
     * With a colour it applies (and replaces) a coloured highlight on just
     * the selected range, making the text readable on it (automatic
     * white / near-black, or `textColor`) and removing any text colour or
     * fill there; without one it toggles a plain `<mark>`.
     */
    setHighlight:
      (opts: { color?: string; textColor?: string | null } = {}) =>
      (editor: EditorInstance): boolean => {
        const color = opts.color ? sanitizeCSSColor(opts.color) : null;
        const selection = editor.getSelection();
        if (!selection) return false;

        if (color) {
          const textColor = sanitizeCSSColor(opts.textColor) ?? contrastTextColor(color);
          const cleared = ["text_color", "background_color"].reduce(
            (doc, mark) => unsetMarkAcrossSelection(doc, selection, mark) ?? doc,
            editor.getJSON(),
          );
          const next = setMarkAcrossSelection(cleared, selection, {
            type: "highlight",
            attrs: { color, textColor },
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
