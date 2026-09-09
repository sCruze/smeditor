/**
 * @smeditor/extension-text-stroke
 *
 * Inline text outline / stroke. Renders as a span with
 * `-webkit-text-stroke` plus `paint-order: stroke fill` so it works in
 * current Chromium/WebKit browsers while round-tripping through JSON.
 */

import type { Extension, EditorInstance } from "@smeditor/core";
import {
  sanitizeCSSColor,
  setMarkAcrossSelection,
  unsetMarkAcrossSelection,
} from "@smeditor/core";

function sanitizeWidth(raw: string | number | undefined): string {
  if (raw == null || raw === "") return "1px";
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/px$/i, ""));
  if (!Number.isFinite(n)) return "1px";
  const clamped = Math.max(0, Math.min(n, 8));
  return `${Math.round(clamped * 100) / 100}px`;
}

function parseStroke(style: string): { color: string; width: string } | false {
  const shorthand = /(?:^|;)\s*(?:-webkit-)?text-stroke\s*:\s*([0-9.]+px)\s+([^;]+)/i.exec(style);
  if (shorthand) {
    const color = sanitizeCSSColor(shorthand[2]);
    return color ? { width: sanitizeWidth(shorthand[1]), color } : false;
  }

  const colorMatch = /(?:^|;)\s*(?:-webkit-)?text-stroke-color\s*:\s*([^;]+)/i.exec(style);
  const widthMatch = /(?:^|;)\s*(?:-webkit-)?text-stroke-width\s*:\s*([^;]+)/i.exec(style);
  if (!colorMatch) return false;
  const color = sanitizeCSSColor(colorMatch[1]);
  return color
    ? { color, width: sanitizeWidth(widthMatch?.[1] ?? "1px") }
    : false;
}

export const TextStrokeExtension: Extension = {
  name: "text_stroke",
  marks: [
    {
      name: "text_stroke",
      inclusive: true,
      attrs: {
        color: { default: null },
        width: { default: "1px" },
      },
      toDOM: (mark) => {
        const color = sanitizeCSSColor(mark.attrs?.color);
        const width = sanitizeWidth(String(mark.attrs?.width ?? "1px"));
        return color
          ? [
              "span",
              {
                style: `-webkit-text-stroke: ${width} ${color}; text-stroke: ${width} ${color}; paint-order: stroke fill`,
              },
              0,
            ]
          : ["span", 0];
      },
      parseDOM: [
        {
          tag: "*",
          getAttrs: (el) => {
            const parsed = parseStroke(el.getAttribute("style") ?? "");
            return parsed || false;
          },
        },
      ],
    },
  ],
  commands: {
    setTextStroke:
      (opts: { color: string; width?: string | number }) =>
      (editor: EditorInstance): boolean => {
        const color = sanitizeCSSColor(opts?.color);
        if (!color) return false;
        const width = sanitizeWidth(opts?.width);
        const selection = editor.getSelection();
        const next = setMarkAcrossSelection(editor.getJSON(), selection, {
          type: "text_stroke",
          attrs: { color, width },
        });
        if (!next) return false;
        editor.dispatch({ doc: next, selection, addToHistory: true });
        return true;
      },
    unsetTextStroke:
      () =>
      (editor: EditorInstance): boolean => {
        const selection = editor.getSelection();
        const next = unsetMarkAcrossSelection(
          editor.getJSON(),
          selection,
          "text_stroke",
        );
        if (!next) return false;
        editor.dispatch({ doc: next, selection, addToHistory: true });
        return true;
      },
  },
};

export default TextStrokeExtension;
