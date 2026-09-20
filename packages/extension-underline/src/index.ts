/**
 * @smeditor/extension-underline
 *
 * Renders to `<u>`, or `<u style="text-decoration-color: …">` when the
 * underline has its own colour; parses both `<u>` and the legacy CSS form
 * `<span style="text-decoration: underline">`. Shortcut: Mod-u.
 *
 * The underline renders innermost (rank 2), so an uncoloured underline
 * follows the colour of the text it sits under.
 */

import type { Extension, EditorInstance } from "@smeditor/core";
import {
  sanitizeCSSColor,
  setMarkAcrossSelection,
  toggleMarkInDoc,
} from "@smeditor/core";

function decorationColor(style: string): string | null {
  const m = /(?:^|;)\s*text-decoration-color\s*:\s*([^;]+)/i.exec(style);
  return m ? sanitizeCSSColor(m[1].trim()) : null;
}

function colorAttrs(el: { getAttribute(name: string): string | null }): Record<string, unknown> {
  const color = decorationColor(el.getAttribute("style") ?? "");
  return color ? { color } : {};
}

function applyUnderline(editor: EditorInstance, color: string | null): boolean {
  const selection = editor.getSelection();
  const next = setMarkAcrossSelection(editor.getJSON(), selection, {
    type: "underline",
    ...(color ? { attrs: { color } } : {}),
  });
  if (!next) return false;
  editor.dispatch({ doc: next, selection, addToHistory: true });
  return true;
}

export const UnderlineExtension: Extension = {
  name: "underline",
  marks: [
    {
      name: "underline",
      inclusive: true,
      rank: 2,
      attrs: { color: { default: null } },
      toDOM: (mark) => {
        const color = sanitizeCSSColor(mark.attrs?.color);
        return color ? ["u", { style: `text-decoration-color: ${color}` }, 0] : ["u", 0];
      },
      parseDOM: [
        { tag: "u", getAttrs: (el) => colorAttrs(el) },
        {
          // Catch <span style="text-decoration: underline"> from MS Word
          // / Google Docs paste. We don't try to be exhaustive — common
          // cases only.
          tag: "span",
          getAttrs: (el) => {
            const style = el.getAttribute("style") ?? "";
            return /text-decoration(?:-line)?:\s*[^;]*underline/i.test(style) ? colorAttrs(el) : false;
          },
        },
      ],
    },
  ],
  commands: {
    toggleUnderline:
      () =>
      (editor: EditorInstance): boolean => {
        const next = toggleMarkInDoc(
          editor.getJSON(),
          editor.getSelection(),
          "underline",
        );
        if (!next) return false;
        editor.dispatch({
          doc: next,
          selection: editor.getSelection(),
          addToHistory: true,
        });
        return true;
      },
    /** setUnderlineColor({ color }) — underlines the selection in `color`. */
    setUnderlineColor:
      (opts: { color: string }) =>
      (editor: EditorInstance): boolean => {
        const color = sanitizeCSSColor(opts?.color);
        return color ? applyUnderline(editor, color) : false;
      },
    /**
     * unsetUnderlineColor() — keeps the underline but drops its own
     * colour, so it follows the text colour again.
     */
    unsetUnderlineColor:
      () =>
      (editor: EditorInstance): boolean =>
        editor.isActive("underline") ? applyUnderline(editor, null) : false,
  },
  keyboardShortcuts: {
    "Mod-u": (editor) => {
      const fn = editor.commands.toggleUnderline;
      return typeof fn === "function" ? fn() : false;
    },
  },
};

export default UnderlineExtension;
