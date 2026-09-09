/**
 * @smeditor/extension-indent
 *
 * Block-level indentation. Sets a `level` attribute on the current
 * block(s); the theme reads that and applies a CSS margin.
 *
 * Conceptually distinct from list nesting:
 *   - List nesting uses `Tab`/`Shift+Tab` inside `bullet_list` /
 *     `ordered_list` to move items between nesting levels. That's
 *     handled in the list-item extension and isn't this one.
 *   - This extension lets you indent **any** block — a paragraph, a
 *     heading, a blockquote — without nesting it. Useful for callouts
 *     and "let me push this paragraph in a bit" cases.
 *
 * Levels are 0..8. Each level corresponds to 24 px of left padding by
 * default; themes can override `--sme-indent-step`.
 */

import type { Extension, EditorInstance } from "@smeditor/core";
import { cloneDoc, leafBlocksInSelection } from "@smeditor/core";

const MAX_LEVEL = 8;

function applyDelta(editor: EditorInstance, delta: number): boolean {
  const sel = editor.getSelection();
  if (!sel) return false;
  const doc = cloneDoc(editor.getJSON());
  // Resolve through leafBlocksInSelection so a deep selection indents
  // the leaf blocks inside table cells, not just the top level.
  const leaves = leafBlocksInSelection(doc, sel);
  if (leaves.length === 0) return false;
  let changed = false;
  for (const { node: block } of leaves) {
    const current = Number(block.attrs?.indent ?? 0) || 0;
    const next = Math.max(0, Math.min(MAX_LEVEL, current + delta));
    if (next === current) continue;
    if (next === 0) {
      if (block.attrs) {
        const { indent, ...rest } = block.attrs;
        if (Object.keys(rest).length === 0) delete block.attrs;
        else block.attrs = rest;
      }
    } else {
      block.attrs = { ...(block.attrs ?? {}), indent: next };
    }
    changed = true;
  }
  if (!changed) return false;
  editor.dispatch({ doc, selection: sel, addToHistory: true });
  return true;
}

export const IndentExtension: Extension = {
  name: "indent",
  commands: {
    /** Move the current block(s) one indent level deeper. */
    indent:
      () =>
      (editor: EditorInstance): boolean =>
        applyDelta(editor, +1),
    /** Move the current block(s) one indent level out. */
    outdent:
      () =>
      (editor: EditorInstance): boolean =>
        applyDelta(editor, -1),
  },
  keyboardShortcuts: {
    Tab: (editor) => {
      // Only swallow Tab when actually changing indent. If we can't,
      // returning false lets the browser handle Tab (focus next field
      // when the editor is the last on the page, etc.).
      return editor.commands.indent?.() ?? false;
    },
    "Shift-Tab": (editor) => {
      return editor.commands.outdent?.() ?? false;
    },
  },
};

export default IndentExtension;
