/**
 * @smeditor/vue — Vue 3 bindings for the SMEditor rich text editor.
 *
 * Public surface:
 *   - useEditor        — composable around `createEditor`.
 *   - Editor           — drop-in all-in-one component.
 *   - EditorContent    — contenteditable surface you mount the editor into.
 */

export { useEditor } from "./useEditor.js";
export type { UseEditorOptions, UseEditorResult } from "./useEditor.js";

export { Editor } from "./Editor.js";
export { EditorContent } from "./EditorContent.js";

// Re-export the convenient core types so hosts can type their own code
// without a direct `@smeditor/core` import.
export type {
  EditorInstance,
  EditorOptions,
  Extension,
  ExtensionBundle,
  DocumentJSON,
  DocumentNode,
  Mark,
  EditorSelection,
  SelectionPoint,
  Command,
  CommandMap,
  EditorEventName,
  EditorEventPayload,
} from "@smeditor/core";
