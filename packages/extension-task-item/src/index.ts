/**
 * @smeditor/extension-task-item
 *
 * Checklist item with a `checked` boolean attribute. Pairs with
 * `@smeditor/extension-task-list` (the `<ul class="task-list">`
 * wrapper).
 *
 * Rendering note: we mark the `<li>` with `data-checked` so CSS can
 * draw a check-box pseudo-element. The default theme handles this.
 * For full interactive toggling (clicking the box flips checked)
 * we need a click handler on the editor surface, which the theme
 * registers via plain `pointerdown` listeners on the editor element —
 * that lives in the editor host, not in this extension.
 */

import type { Extension, EditorInstance, DocumentNode } from "@smeditor/core";
import { cloneDoc } from "@smeditor/core";

export const TaskItemExtension: Extension = {
  name: "task_item",
  nodes: [
    {
      name: "task_item",
      group: "block",
      content: "block+",
      attrs: { checked: { default: false } },
      toDOM: (node: DocumentNode) => {
        const checked = Boolean(node.attrs?.checked);
        return [
          "li",
          {
            class: `smeditor-task-item${checked ? " is-checked" : ""}`,
            "data-checked": checked ? "true" : "false",
          },
          0,
        ];
      },
      parseDOM: [
        {
          tag: "li",
          getAttrs: (el) => {
            const cls = el.getAttribute("class") ?? "";
            if (!/smeditor-task-item|task-item/i.test(cls)) return false;
            const checked = el.getAttribute("data-checked") === "true";
            return { checked };
          },
        },
      ],
    },
  ],
  commands: {
    /**
     * Toggle the `checked` attribute on the task_item under the
     * current selection.
     */
    toggleTaskChecked:
      () =>
      (editor: EditorInstance): boolean => {
        const sel = editor.getSelection();
        if (!sel) return false;
        const doc = cloneDoc(editor.getJSON());
        // Walk to find the nearest task_item ancestor of the selection.
        // Our selection paths are top-level-indexed; we recurse to find
        // the deepest task_item that wraps it.
        const path = sel.anchor.path;
        let node: DocumentNode | undefined = doc;
        let target: DocumentNode | undefined;
        for (const idx of path) {
          if (!node?.content) break;
          node = node.content[idx];
          if (node?.type === "task_item") target = node;
        }
        if (!target) return false;
        target.attrs = {
          ...(target.attrs ?? {}),
          checked: !target.attrs?.checked,
        };
        editor.dispatch({ doc, selection: sel, addToHistory: true });
        return true;
      },
  },
};

export default TaskItemExtension;
