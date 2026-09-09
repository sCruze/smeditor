/**
 * @smeditor/extension-line-height
 *
 * Block-level line spacing — the last piece of §5. Sets a
 * `lineHeight` attribute on the leaf block(s) under the selection;
 * the paragraph and heading extensions read it and emit
 * `style="line-height: …"`.
 *
 * Accepted values: a unitless multiplier (`1`, `1.5`, `2`) or a
 * number with a CSS unit (`px`, `em`, `rem`, `%`). Anything else is
 * rejected. `setLineHeight({ value: null })` clears it.
 */

import type { Extension, EditorInstance } from "@smeditor/core";
import { setBlockAttrs } from "@smeditor/core";

const LINE_HEIGHT_TOKEN = /^(\d+(?:\.\d+)?)(px|em|rem|%)?$/;

function sanitize(raw: string): string | null {
  const t = String(raw).trim();
  const m = LINE_HEIGHT_TOKEN.exec(t);
  if (!m) return null;
  const value = Number(m[1]);
  if (!Number.isFinite(value) || value <= 0 || value > 10) return null;
  return m[2] ? `${m[1]}${m[2]}` : m[1];
}

export const LineHeightExtension: Extension = {
  name: "line_height",
  commands: {
    /**
     * setLineHeight({ value }) — applies to every leaf block the
     * selection touches, reaching into table cells / blockquotes /
     * list items. Pass `{ value: null }` to clear.
     */
    setLineHeight:
      (opts: { value: string | number | null }) =>
      (editor: EditorInstance): boolean => {
        const selection = editor.getSelection();
        if (!selection) return false;

        const raw = opts?.value;
        const value =
          raw === null || raw === undefined ? null : sanitize(String(raw));
        if (raw !== null && raw !== undefined && value === null) return false;

        const next = setBlockAttrs(editor.getJSON(), selection, {
          lineHeight: value,
        });
        if (!next) return false;
        editor.dispatch({ doc: next, selection, addToHistory: true });
        return true;
      },
    unsetLineHeight:
      () =>
      (editor: EditorInstance): boolean => {
        const fn = editor.commands.setLineHeight;
        return typeof fn === "function" ? fn({ value: null }) : false;
      },
  },
};

export default LineHeightExtension;
