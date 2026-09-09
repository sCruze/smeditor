/**
 * @smeditor/extension-ordered-list
 *
 * `<ol>` counterpart of bullet-list. Same toggle semantics, same
 * dependency on `@smeditor/extension-list-item`. A future iteration
 * will add a `start` attribute for lists that don't begin at 1.
 */

import type { Extension, EditorInstance } from "@smeditor/core";
import { toggleWrap, selectionInsideWrapper } from "@smeditor/core";

export const OrderedListExtension: Extension = {
  name: "ordered_list",
  nodes: [
    {
      name: "ordered_list",
      group: "block",
      content: "list_item+",
      attrs: { start: { default: 1 } },
      toDOM: (node) => {
        const start = node.attrs?.start;
        const attrs: Record<string, string | number> = {};
        if (typeof start === "number" && start !== 1) attrs.start = start;
        return Object.keys(attrs).length > 0 ? ["ol", attrs, 0] : ["ol", 0];
      },
      parseDOM: [
        {
          tag: "ol",
          getAttrs: (el) => {
            const start = Number(el.getAttribute("start"));
            return Number.isInteger(start) && start > 0
              ? { start }
              : null;
          },
        },
      ],
    },
  ],
  commands: {
    toggleOrderedList:
      () =>
      (editor: EditorInstance): boolean => {
        const next = toggleWrap(
          editor.getJSON(),
          editor.getSelection(),
          "ordered_list",
          "list_item",
        );
        if (!next) return false;
        editor.dispatch({
          doc: next,
          selection: editor.getSelection(),
          addToHistory: true,
        });
        return true;
      },
  },
  keyboardShortcuts: {
    "Mod-Shift-7": (editor) => {
      const fn = editor.commands.toggleOrderedList;
      return typeof fn === "function" ? fn() : false;
    },
  },
};

export function isOrderedListActive(editor: EditorInstance): boolean {
  return selectionInsideWrapper(
    editor.getJSON(),
    editor.getSelection(),
    "ordered_list",
  );
}

export default OrderedListExtension;
