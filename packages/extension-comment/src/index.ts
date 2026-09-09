/**
 * @smeditor/extension-comment
 *
 * Inline comment threads — the first piece of §14 (collaboration).
 *
 * The extension owns only the *marking*: a `comment` mark carrying a
 * `threadId` (and a `resolved` flag). The actual thread content —
 * messages, authors, timestamps — is **not** stored here. That's the
 * host application's job: it keeps a thread store keyed by `threadId`
 * and decides where it lives (memory, server, a collab backend).
 *
 * This split is deliberate. The document model stays about content;
 * the comment mark is just a durable, serialisable pointer from a
 * span of text to a thread the host manages. `getCommentThreads(doc)`
 * lets the host reconcile its store with the marks still present.
 *
 * Range note: like the other mark commands, `addComment` currently
 * marks the text nodes of every block the selection touches — it
 * does not split text nodes at the selection offsets. So a comment
 * attaches to whole blocks, not an arbitrary phrase. Precise-range
 * comments wait on the core Transform API.
 */

import type {
  Extension,
  EditorInstance,
  Mark,
  DocumentJSON,
  DOMOutputSpec,
} from "@smeditor/core";
import { cloneDoc, applyMarkToInlineRange, inlineLength } from "@smeditor/core";

// ============================================================================
// Mark
// ============================================================================

function commentToDOM(mark: Mark): DOMOutputSpec {
  const threadId = String(mark.attrs?.threadId ?? "");
  const resolved = Boolean(mark.attrs?.resolved);
  if (!threadId) return ["span", 0];
  const cls =
    "smeditor-comment" + (resolved ? " smeditor-comment--resolved" : "");
  return ["span", { class: cls, "data-comment-thread": threadId }, 0];
}

const commentMark = {
  name: "comment",
  // A comment shouldn't swallow text typed at its edge.
  inclusive: false,
  attrs: {
    threadId: { default: null },
    resolved: { default: false },
  },
  toDOM: commentToDOM,
  parseDOM: [
    {
      tag: "span[data-comment-thread]",
      getAttrs: (el: HTMLElement) => {
        const threadId = el.getAttribute("data-comment-thread");
        if (!threadId) return false;
        return {
          threadId,
          resolved: el.classList.contains("smeditor-comment--resolved"),
        };
      },
    },
  ],
};

// ============================================================================
// Helpers
// ============================================================================

export interface CommentThreadRef {
  threadId: string;
  resolved: boolean;
}

/**
 * Every distinct comment thread referenced by the document, with its
 * resolved state. Hosts use this to drop store entries whose marks
 * have been deleted, and to render a comments panel.
 */
export function getCommentThreads(doc: DocumentJSON): CommentThreadRef[] {
  const byId = new Map<string, boolean>();
  const walk = (nodes: DocumentJSON["content"] | undefined) => {
    if (!nodes) return;
    for (const node of nodes) {
      if (node.type === "text" && node.marks) {
        for (const m of node.marks) {
          if (m.type === "comment" && m.attrs?.threadId) {
            const id = String(m.attrs.threadId);
            // A thread is resolved only if every mark says so.
            const prev = byId.get(id);
            const resolved = Boolean(m.attrs.resolved);
            byId.set(id, prev === undefined ? resolved : prev && resolved);
          }
        }
      }
      walk(node.content);
    }
  };
  walk(doc.content);
  return [...byId.entries()].map(([threadId, resolved]) => ({
    threadId,
    resolved,
  }));
}

/** Apply `fn` to every comment mark for `threadId`; returns true if any changed. */
function updateThreadMarks(
  doc: DocumentJSON,
  threadId: string,
  fn: (marks: NonNullable<DocumentJSON["content"][number]["marks"]>, index: number) => boolean,
): boolean {
  let changed = false;
  const walk = (nodes: DocumentJSON["content"] | undefined) => {
    if (!nodes) return;
    for (const node of nodes) {
      if (node.type === "text" && node.marks) {
        for (let i = 0; i < node.marks.length; i++) {
          const m = node.marks[i];
          if (m.type === "comment" && m.attrs?.threadId === threadId) {
            if (fn(node.marks, i)) changed = true;
          }
        }
        if (node.marks.length === 0) delete node.marks;
      }
      walk(node.content);
    }
  };
  walk(doc.content);
  return changed;
}

// ============================================================================
// Extension
// ============================================================================

export const CommentExtension: Extension = {
  name: "comment",
  marks: [commentMark],
  commands: {
    /**
     * addComment({ threadId }) — mark the selected text range as
     * belonging to a thread. The host generates `threadId` and
     * creates the thread in its own store.
     *
     * Re-based on the Transform API: the mark now covers the exact
     * selected character range, not whole blocks. A collapsed
     * selection (nothing selected) is a no-op.
     */
    addComment:
      (opts: { threadId: string }) =>
      (editor: EditorInstance): boolean => {
        const threadId = opts?.threadId;
        if (!threadId) return false;
        const sel = editor.getSelection();
        if (!sel) return false;

        const aIdx = sel.anchor.path[0] ?? 0;
        const hIdx = sel.head.path[0] ?? 0;
        const startIdx = Math.min(aIdx, hIdx);
        const endIdx = Math.max(aIdx, hIdx);
        // Offsets in document order.
        let startOff: number;
        let endOff: number;
        if (aIdx < hIdx) {
          startOff = sel.anchor.offset ?? 0;
          endOff = sel.head.offset ?? 0;
        } else if (aIdx > hIdx) {
          startOff = sel.head.offset ?? 0;
          endOff = sel.anchor.offset ?? 0;
        } else {
          startOff = Math.min(sel.anchor.offset ?? 0, sel.head.offset ?? 0);
          endOff = Math.max(sel.anchor.offset ?? 0, sel.head.offset ?? 0);
        }

        const doc = cloneDoc(editor.getJSON());
        const mark = {
          type: "comment",
          attrs: { threadId, resolved: false },
        };
        let changed = false;
        for (let i = startIdx; i <= endIdx; i++) {
          const block = doc.content[i];
          if (!block?.content) continue;
          const from = i === startIdx ? startOff : 0;
          const to = i === endIdx ? endOff : inlineLength(block);
          if (to <= from) continue;
          const next = applyMarkToInlineRange(block.content, from, to, mark);
          if (JSON.stringify(next) !== JSON.stringify(block.content)) {
            block.content = next;
            changed = true;
          }
        }
        if (!changed) return false;
        editor.dispatch({ doc, selection: sel, addToHistory: true });
        return true;
      },

    /** removeComment({ threadId }) — strip a thread's marks entirely. */
    removeComment:
      (opts: { threadId: string }) =>
      (editor: EditorInstance): boolean => {
        if (!opts?.threadId) return false;
        const doc = cloneDoc(editor.getJSON());
        const changed = updateThreadMarks(doc, opts.threadId, (marks, i) => {
          marks.splice(i, 1);
          return true;
        });
        if (!changed) return false;
        editor.dispatch({
          doc,
          selection: editor.getSelection() ?? undefined,
          addToHistory: true,
        });
        return true;
      },

    /** resolveComment({ threadId }) — flag a thread's marks resolved. */
    resolveComment:
      (opts: { threadId: string }) =>
      (editor: EditorInstance): boolean =>
        setResolved(editor, opts?.threadId, true),

    /** reopenComment({ threadId }) — clear the resolved flag. */
    reopenComment:
      (opts: { threadId: string }) =>
      (editor: EditorInstance): boolean =>
        setResolved(editor, opts?.threadId, false),
  },
};

function setResolved(
  editor: EditorInstance,
  threadId: string | undefined,
  resolved: boolean,
): boolean {
  if (!threadId) return false;
  const doc = cloneDoc(editor.getJSON());
  const changed = updateThreadMarks(doc, threadId, (marks, i) => {
    const m = marks[i];
    if (Boolean(m.attrs?.resolved) === resolved) return false;
    m.attrs = { ...(m.attrs ?? {}), resolved };
    return true;
  });
  if (!changed) return false;
  editor.dispatch({
    doc,
    selection: editor.getSelection() ?? undefined,
    addToHistory: true,
  });
  return true;
}

export default CommentExtension;
