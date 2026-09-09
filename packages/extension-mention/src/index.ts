/**
 * @smeditor/extension-mention
 *
 * `@`-mentions — the §14 mention feature. A `mention` is an inline
 * node referencing a person or item by `id`, displayed as a pill.
 *
 * The node carries its rendered label as a text child ("@label"), so
 * it round-trips through HTML and shows up in `getBlockText`. It's
 * rendered `contenteditable="false"` so the caret treats it as one
 * atomic unit.
 *
 * Insertion: `insertMention` replaces a trailing `@query` in the
 * block's last text node. This deliberately targets the common case
 * — you type `@`, pick someone, and the mention lands where you were
 * typing. Inserting into the middle of pre-existing text is a
 * separate concern that waits on the core Transform API.
 */

import type {
  Extension,
  EditorInstance,
  DocumentNode,
  DOMOutputSpec,
} from "@smeditor/core";
import {
  cloneDoc,
  nodeAt,
  blockVisibleText,
  replaceInlineRange,
  visibleLength as nodeVisibleLength,
} from "@smeditor/core";

// ============================================================================
// Node
// ============================================================================

function mentionToDOM(node: DocumentNode): DOMOutputSpec {
  const id = String(node.attrs?.id ?? "");
  const label = String(node.attrs?.label ?? "");
  return [
    "span",
    {
      class: "smeditor-mention",
      "data-mention-id": id,
      "data-mention-label": label,
      contenteditable: "false",
    },
    0,
  ];
}

const mentionNode = {
  name: "mention",
  group: "inline" as const,
  // Holds the visible "@label" text so it serialises and counts. The
  // node is NOT marked `atom` — the parser must descend to recover
  // that text child. The pill is made caret-atomic in the DOM via
  // `contenteditable="false"`.
  content: "text*",
  attrs: {
    id: { default: null },
    label: { default: "" },
  },
  toDOM: mentionToDOM,
  parseDOM: [
    {
      tag: "span[data-mention-id]",
      getAttrs: (el: HTMLElement) => {
        const id = el.getAttribute("data-mention-id");
        const label =
          el.getAttribute("data-mention-label") ??
          (el.textContent ?? "").replace(/^@/, "");
        return { id, label };
      },
    },
  ],
};

// ============================================================================
// Helpers
// ============================================================================

/** A mention node for `id` / `label`, with its "@label" text child. */
export function makeMentionNode(id: string, label: string): DocumentNode {
  return {
    type: "mention",
    attrs: { id, label },
    content: [{ type: "text", text: "@" + label }],
  };
}

// ============================================================================
// Extension
// ============================================================================

export interface InsertMentionOptions {
  id: string;
  label: string;
}

export const MentionExtension: Extension = {
  name: "mention",
  nodes: [mentionNode],
  commands: {
    /**
     * insertMention({ id, label }) — replace the `@query` immediately
     * before the caret with a mention node, followed by a space.
     *
     * Unlike the i14 version, this works anywhere in a block — it
     * uses the caret offset and the Transform API to replace the
     * exact `@query` range, not just a trailing text node.
     */
    insertMention:
      (opts: InsertMentionOptions) =>
      (editor: EditorInstance): boolean => {
        const { id, label } = opts ?? {};
        if (!label) return false;
        const sel = editor.getSelection();
        if (!sel) return false;
        const blockPath = sel.anchor.path;
        const caret = sel.anchor.offset ?? 0;

        const doc = cloneDoc(editor.getJSON());
        const block = nodeAt(doc, blockPath);
        if (!block?.content) return false;

        // Find the "@" that starts the query, scanning back from the
        // caret through the block's visible text.
        const upToCaret = blockVisibleText(block).slice(0, caret);
        const match = /@(\w*)$/.exec(upToCaret);
        if (!match) return false;
        const atOffset = match.index;

        const mention = makeMentionNode(String(id ?? ""), label);
        const space: DocumentNode = { type: "text", text: " " };
        block.content = replaceInlineRange(block.content, atOffset, caret, [
          mention,
          space,
        ]);

        const newCaret = atOffset + nodeVisibleLength(mention) + 1;
        editor.dispatch({
          doc,
          selection: {
            anchor: { path: blockPath, offset: newCaret },
            head: { path: blockPath, offset: newCaret },
          },
          addToHistory: true,
        });
        return true;
      },
  },
};

export default MentionExtension;
