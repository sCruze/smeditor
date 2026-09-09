/**
 * @smeditor/extension-history
 *
 * The history stack and the built-in `undo` / `redo` commands live in
 * core (every editor needs them). This package exists for two reasons:
 *
 *   1. Discoverability — users who follow the "everything is an extension"
 *      mental model can `import { HistoryExtension } from
 *      "@smeditor/extension-history"` and expect it to do something.
 *
 *   2. Shortcut declaration — core registers Cmd-Z / Cmd-Shift-Z as a
 *      fallback, but having an explicit extension lets a user *replace*
 *      them with their own bindings without monkey-patching.
 */

import type { Extension, EditorInstance } from "@smeditor/core";

export const HistoryExtension: Extension = {
  name: "history",
  keyboardShortcuts: {
    "Mod-z": (editor: EditorInstance) =>
      typeof editor.commands.undo === "function"
        ? editor.commands.undo()
        : false,
    "Mod-Shift-z": (editor: EditorInstance) =>
      typeof editor.commands.redo === "function"
        ? editor.commands.redo()
        : false,
    "Mod-y": (editor: EditorInstance) =>
      typeof editor.commands.redo === "function"
        ? editor.commands.redo()
        : false,
  },
};

export default HistoryExtension;
