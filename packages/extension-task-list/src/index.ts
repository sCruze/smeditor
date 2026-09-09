/**
 * @smeditor/extension-task-list
 *
 * `<ul class="smeditor-task-list">` container for `task_item` nodes.
 * Requires `@smeditor/extension-task-item` for the actual rows.
 */

import type { Extension, EditorInstance } from "@smeditor/core";
import { toggleWrap, selectionInsideWrapper } from "@smeditor/core";

export const TaskListExtension: Extension = {
  name: "task_list",
  nodes: [
    {
      name: "task_list",
      group: "block",
      content: "task_item+",
      toDOM: () => ["ul", { class: "smeditor-task-list" }, 0],
      parseDOM: [
        {
          tag: "ul",
          getAttrs: (el) => {
            const cls = el.getAttribute("class") ?? "";
            return /smeditor-task-list|task-list/i.test(cls) ? {} : false;
          },
        },
      ],
    },
  ],
  commands: {
    toggleTaskList:
      () =>
      (editor: EditorInstance): boolean => {
        const next = toggleWrap(
          editor.getJSON(),
          editor.getSelection(),
          "task_list",
          "task_item",
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
    "Mod-Shift-9": (editor) =>
      editor.commands.toggleTaskList?.() ?? false,
  },
};

export function isTaskListActive(editor: EditorInstance): boolean {
  return selectionInsideWrapper(
    editor.getJSON(),
    editor.getSelection(),
    "task_list",
  );
}

export default TaskListExtension;
