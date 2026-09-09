/**
 * DragHandle — a grab handle for reordering top-level blocks, plus a
 * drop-cursor indicator.
 *
 * Render it once alongside the editor. As the pointer moves over the
 * editing surface a small ⠿ handle parks at the left edge of the
 * hovered top-level block (a direct child of `editor.element`). Pressing
 * the handle starts a drag: a horizontal drop-cursor line tracks the
 * nearest gap between blocks under the pointer, and on release the
 * dragged block is moved to that gap by rewriting `doc.content`.
 *
 * Top-level DOM children correspond 1:1 to `doc.content`, so a DOM child
 * index is also a document block index — the move is a plain array
 * splice followed by `editor.dispatch`.
 *
 * Like the resizer overlays this is a fixed-position layer measured from
 * `getBoundingClientRect()`. It does nothing in read-only mode.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { EditorInstance, DocumentJSON, DocumentNode } from "@smeditor/core";

export interface DragHandleProps {
  editor: EditorInstance | null;
}

interface HandleRect {
  /** Index of the hovered block among editor.element's children. */
  index: number;
  /** Viewport top of the block. */
  top: number;
  /** Viewport left of the block. */
  left: number;
  /** Block height, used to vertically center the handle. */
  height: number;
}

interface DropState {
  /** Index of the block being dragged. */
  from: number;
  /** Gap index the drop cursor currently points at (0..childCount). */
  gap: number;
  /** Viewport y of the drop-cursor line. */
  y: number;
  /** Viewport left of the drop-cursor line. */
  left: number;
  /** Drop-cursor line width. */
  width: number;
}

/** Walk up from `el` to the direct child of `root`, or null. */
function topLevelChild(root: HTMLElement, el: Element | null): HTMLElement | null {
  let node: Element | null = el;
  while (node && node.parentElement && node.parentElement !== root) {
    node = node.parentElement;
  }
  if (!node || node.parentElement !== root) return null;
  return node instanceof HTMLElement ? node : null;
}

function isEditable(editor: EditorInstance | null): editor is EditorInstance {
  if (!editor) return false;
  const root = editor.element;
  return !!root && root.getAttribute("contenteditable") !== "false";
}

export function DragHandle({ editor }: DragHandleProps) {
  const [handle, setHandle] = useState<HandleRect | null>(null);
  const [drop, setDrop] = useState<DropState | null>(null);
  const dragRef = useRef<DropState | null>(null);
  const rafRef = useRef<number | null>(null);

  // Compute the drop gap (and its overlay geometry) for a pointer y.
  const computeDrop = useCallback(
    (from: number, clientY: number): DropState | null => {
      if (!editor) return null;
      const root = editor.element;
      if (!root) return null;
      const children = Array.from(root.children).filter(
        (c): c is HTMLElement => c instanceof HTMLElement,
      );
      if (children.length === 0) return null;

      const rootRect = root.getBoundingClientRect();
      // Find the nearest gap: the first block whose vertical midpoint is
      // below the pointer marks the gap before it; otherwise it's the end.
      let gap = children.length;
      for (let i = 0; i < children.length; i++) {
        const r = children[i].getBoundingClientRect();
        if (clientY < r.top + r.height / 2) {
          gap = i;
          break;
        }
      }

      // Position the line at the chosen gap.
      let y: number;
      if (gap === 0) {
        y = children[0].getBoundingClientRect().top;
      } else if (gap >= children.length) {
        y = children[children.length - 1].getBoundingClientRect().bottom;
      } else {
        const prev = children[gap - 1].getBoundingClientRect();
        const curr = children[gap].getBoundingClientRect();
        y = (prev.bottom + curr.top) / 2;
      }

      return {
        from,
        gap,
        y,
        left: rootRect.left,
        width: rootRect.width,
      };
    },
    [editor],
  );

  // Hover tracking — position the handle at the hovered top-level block.
  useEffect(() => {
    if (!editor) return;
    const root = editor.element;
    if (!root) return;

    const onMove = (e: MouseEvent) => {
      // While dragging, the document-level handlers own the pointer.
      if (dragRef.current) return;
      if (!isEditable(editor)) {
        setHandle(null);
        return;
      }
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const target = document.elementFromPoint(e.clientX, e.clientY);
        const child = topLevelChild(root, target);
        if (!child) {
          setHandle(null);
          return;
        }
        const index = Array.from(root.children).indexOf(child);
        if (index < 0) {
          setHandle(null);
          return;
        }
        const r = child.getBoundingClientRect();
        setHandle({ index, top: r.top, left: r.left, height: r.height });
      });
    };

    const onLeave = () => {
      if (dragRef.current) return;
      setHandle(null);
    };

    root.addEventListener("mousemove", onMove);
    root.addEventListener("mouseleave", onLeave);
    return () => {
      root.removeEventListener("mousemove", onMove);
      root.removeEventListener("mouseleave", onLeave);
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [editor]);

  // Drag lifecycle — document-level listeners so the drag continues even
  // when the pointer leaves the editor surface.
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const next = computeDrop(dragRef.current.from, e.clientY);
      if (next) {
        dragRef.current = next;
        setDrop(next);
      }
    };
    const onUp = () => {
      const state = dragRef.current;
      dragRef.current = null;
      setDrop(null);
      document.body.style.removeProperty("cursor");
      if (!state || !editor) return;

      const from = state.from;
      // `gap` is an insertion index into the original array. Once the
      // source is removed, a target after it shifts down by one.
      let target = state.gap;
      if (target > from) target -= 1;
      if (target === from) return;

      const doc = editor.getJSON();
      const content: DocumentNode[] = doc.content.slice();
      if (from < 0 || from >= content.length) return;
      if (target < 0 || target >= content.length) return;
      const [moved] = content.splice(from, 1);
      content.splice(target, 0, moved);

      const nextDoc: DocumentJSON = { ...doc, content };
      editor.dispatch({
        doc: nextDoc,
        selection: {
          anchor: { path: [target], offset: 0 },
          head: { path: [target], offset: 0 },
        },
        addToHistory: true,
      });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [editor, computeDrop]);

  if (!isEditable(editor) || !handle) {
    // Still render the drop cursor if a drag is in flight (handle may be
    // hidden once the pointer leaves a block), otherwise render nothing.
    if (!drop) return null;
  }

  const startDrag = (e: React.MouseEvent) => {
    if (!handle || !isEditable(editor)) return;
    e.preventDefault();
    const initial = computeDrop(handle.index, e.clientY);
    const state: DropState =
      initial ?? { from: handle.index, gap: handle.index, y: handle.top, left: handle.left, width: 0 };
    dragRef.current = state;
    setDrop(state);
    document.body.style.cursor = "grabbing";
  };

  return (
    <>
      {handle ? (
        <span
          className="smeditor-drag-handle"
          style={{
            position: "fixed",
            top: handle.top + handle.height / 2 - 10,
            left: handle.left - 22,
            width: 18,
            height: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "grab",
            userSelect: "none",
            lineHeight: 1,
            zIndex: 900,
          }}
          onMouseDown={startDrag}
          aria-hidden="true"
        >
          ⠿
        </span>
      ) : null}
      {drop ? (
        <div
          className="smeditor-drop-cursor"
          style={{
            position: "fixed",
            top: drop.y - 1,
            left: drop.left,
            width: drop.width,
            height: 2,
            pointerEvents: "none",
            zIndex: 1000,
          }}
        />
      ) : null}
    </>
  );
}
