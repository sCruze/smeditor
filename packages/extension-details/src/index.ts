/**
 * @smeditor/extension-details
 *
 * A collapsible disclosure block — the Tiptap "Details" pattern rendered
 * as native `<details><summary>…</summary>…</details>`. The block has a
 * summary (the always-visible label) and a body of one or more blocks.
 *
 * Two nodes:
 *   - `details`         — the wrapper, with an `open` attribute mirroring
 *                         the `<details open>` HTML attribute.
 *   - `details_summary` — the clickable summary line (inline content).
 *
 * Three commands:
 *   - `setDetails()`        — wrap the current block(s) in a details.
 *   - `toggleDetails()`     — wrap, or unwrap if already inside one.
 *   - `toggleDetailsOpen()` — flip the open/closed state.
 */

import type {
  Extension,
  EditorInstance,
  DocumentNode,
  DocumentJSON,
  NodeSpec,
  DOMOutputSpec,
} from "@smeditor/core";
import {
  cloneDoc,
  nodeAt,
  selectionInsideWrapper,
  selectionBlockRange,
} from "@smeditor/core";

// ============================================================================
// Node specs
// ============================================================================

const detailsNode: NodeSpec = {
  name: "details",
  group: "block",
  content: "details_summary block+",
  attrs: { open: { default: true } },
  toDOM: (node: DocumentNode): DOMOutputSpec =>
    node.attrs?.open
      ? ["details", { open: "true", class: "smeditor-details" }, 0]
      : ["details", { class: "smeditor-details" }, 0],
  parseDOM: [
    {
      tag: "details",
      getAttrs: (el: HTMLElement) => ({ open: hasOpenAttr(el) }),
    },
  ],
};

const summaryNode: NodeSpec = {
  name: "details_summary",
  group: "block",
  content: "inline*",
  toDOM: (): DOMOutputSpec => [
    "summary",
    { class: "smeditor-details-summary" },
    0,
  ],
  parseDOM: [{ tag: "summary" }],
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Whether a `<details>` element is open. Uses `hasAttribute` in a real
 * browser; in the SSR / test parser (which only exposes `getAttribute`)
 * it falls back to checking the attribute's presence — a valueless
 * `<details open>` reads back as "" there, and `<details open="true">`
 * reads back as "true", both non-null.
 */
function hasOpenAttr(el: HTMLElement): boolean {
  if (typeof el.hasAttribute === "function") return el.hasAttribute("open");
  return el.getAttribute("open") !== null;
}

/** Build a fresh details summary node carrying the default label. */
function makeSummary(): DocumentNode {
  return {
    type: "details_summary",
    content: [{ type: "text", text: "Details" }],
  };
}

/**
 * Locate the nearest `details` ancestor of the selection anchor, walking
 * the path from deepest to shallowest. Returns its path, or null.
 */
function detailsAncestorPath(
  doc: DocumentJSON,
  path: number[],
): number[] | null {
  for (let depth = path.length; depth >= 1; depth--) {
    const candidate = path.slice(0, depth);
    const node = nodeAt(doc, candidate);
    if (node?.type === "details") return candidate;
  }
  return null;
}

/** A collapsed selection at the start of `path`. */
function caretPath(path: number[]) {
  return {
    anchor: { path, offset: 0 },
    head: { path, offset: 0 },
  };
}

// ============================================================================
// Extension
// ============================================================================

export const DetailsExtension: Extension = {
  name: "details",
  nodes: [detailsNode, summaryNode],
  commands: {
    /**
     * setDetails() — wrap the top-level block(s) touched by the
     * selection into a `details` whose first child is a
     * `details_summary` ("Details"), followed by the original block(s).
     */
    setDetails:
      () =>
      (editor: EditorInstance): boolean => {
        const sel = editor.getSelection();
        const range = selectionBlockRange(sel) ?? [0, 0];
        const [start, end] = range;

        const doc = cloneDoc(editor.getJSON());
        const blocks: DocumentNode[] = [];
        for (let i = start; i <= end; i++) {
          const block = doc.content[i];
          if (block) blocks.push(block);
        }
        if (blocks.length === 0) return false;

        const details: DocumentNode = {
          type: "details",
          attrs: { open: true },
          content: [makeSummary(), ...blocks],
        };

        doc.content.splice(start, end - start + 1, details);

        // Caret into the summary so the user can immediately rename it.
        editor.dispatch({
          doc,
          selection: caretPath([start, 0]),
          addToHistory: true,
        });
        return true;
      },

    /**
     * toggleDetails() — if the selection already sits inside a
     * `details`, unwrap it (drop the summary, hoist the body blocks
     * back out); otherwise wrap it via setDetails.
     */
    toggleDetails:
      () =>
      (editor: EditorInstance): boolean => {
        const sel = editor.getSelection();
        const sourceDoc = editor.getJSON();

        if (!selectionInsideWrapper(sourceDoc, sel, "details")) {
          return editor.commands.setDetails?.() ?? false;
        }

        const path = sel?.anchor.path ?? [];
        const wrapperPath = detailsAncestorPath(sourceDoc, path);
        if (!wrapperPath) return false;

        const doc = cloneDoc(sourceDoc);
        const details = nodeAt(doc, wrapperPath);
        if (!details?.content) return false;

        // Everything but the summary is hoisted back into the parent.
        const body = details.content.filter(
          (child) => child.type !== "details_summary",
        );
        const hoisted: DocumentNode[] =
          body.length > 0 ? body : [{ type: "paragraph", content: [] }];

        const parentPath = wrapperPath.slice(0, -1);
        const index = wrapperPath[wrapperPath.length - 1];
        const parent = nodeAt(doc, parentPath);
        if (!parent?.content) return false;
        parent.content.splice(index, 1, ...hoisted);

        editor.dispatch({
          doc,
          selection: caretPath([...parentPath, index]),
          addToHistory: true,
        });
        return true;
      },

    /**
     * toggleDetailsOpen() — flip the `open` attribute on the nearest
     * `details` ancestor of the selection.
     */
    toggleDetailsOpen:
      () =>
      (editor: EditorInstance): boolean => {
        const sel = editor.getSelection();
        const path = sel?.anchor.path ?? [];
        const sourceDoc = editor.getJSON();
        const wrapperPath = detailsAncestorPath(sourceDoc, path);
        if (!wrapperPath) return false;

        const doc = cloneDoc(sourceDoc);
        const details = nodeAt(doc, wrapperPath);
        if (!details) return false;
        const current = details.attrs?.open ?? true;
        details.attrs = { ...(details.attrs ?? {}), open: !current };

        editor.dispatch({
          doc,
          selection: sel ?? caretPath(wrapperPath),
          addToHistory: true,
        });
        return true;
      },
  },
  keyboardShortcuts: {
    "Mod-Shift-d": (editor) => {
      const fn = editor.commands.toggleDetails;
      return typeof fn === "function" ? fn() : false;
    },
  },
};

/**
 * Helper for toolbar buttons: is the selection inside a details block?
 * (Re-exported so consumers don't need to import core directly.)
 */
export function isDetailsActive(editor: EditorInstance): boolean {
  return selectionInsideWrapper(
    editor.getJSON(),
    editor.getSelection(),
    "details",
  );
}

export default DetailsExtension;
