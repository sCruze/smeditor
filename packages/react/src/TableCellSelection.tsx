/**
 * TableCellSelection — drag or shift-click across table cells to
 * select a rectangle of them. The cell-range part of §10.
 *
 * Render it once inside `<EditorProvider>`. It has no visible DOM of
 * its own — it works by toggling the `smeditor-cell--selected` class
 * on `<td>` / `<th>` elements, which the theme highlights. The
 * `mergeCells` command reads that same class back out of the DOM.
 *
 * Deliberately geometric: the selected rectangle is computed from
 * `getBoundingClientRect`, not from the table model. That keeps this
 * component free of any dependency on `@smeditor/extension-table` —
 * the React package stays extension-agnostic — and it handles merged
 * cells correctly for free, since a merged cell simply has a larger
 * rectangle.
 *
 * Interaction:
 *  - drag from one cell across others → selects the rectangle
 *  - shift-click a cell → extends the rectangle from the last anchor
 *  - a plain click, or typing, clears the selection
 */

import { useEffect } from "react";
import { useEditorContext } from "./Editor.js";

const SELECTED_CLASS = "smeditor-cell--selected";

export function TableCellSelection() {
  const editor = useEditorContext();

  useEffect(() => {
    if (!editor) return;
    const root = editor.element;
    if (!root) return;

    // The cell a drag / shift-range is anchored to.
    let anchorCell: Element | null = null;
    let dragging = false;

    const cellOf = (node: Node | null): Element | null => {
      let n: Node | null = node;
      while (n && n !== root) {
        if (n.nodeType === 1) {
          const tag = (n as Element).tagName.toLowerCase();
          if (tag === "td" || tag === "th") return n as Element;
        }
        n = n.parentNode;
      }
      return null;
    };

    const clear = () => {
      root
        .querySelectorAll("." + SELECTED_CLASS)
        .forEach((el) => el.classList.remove(SELECTED_CLASS));
    };

    /** Highlight every cell whose centre falls inside anchor..focus. */
    const highlight = (anchor: Element, focus: Element) => {
      const table = anchor.closest("table");
      if (!table || focus.closest("table") !== table) return;
      const a = anchor.getBoundingClientRect();
      const f = focus.getBoundingClientRect();
      const box = {
        top: Math.min(a.top, f.top),
        left: Math.min(a.left, f.left),
        bottom: Math.max(a.bottom, f.bottom),
        right: Math.max(a.right, f.right),
      };
      clear();
      table.querySelectorAll("td, th").forEach((cell) => {
        const r = cell.getBoundingClientRect();
        const cx = (r.left + r.right) / 2;
        const cy = (r.top + r.bottom) / 2;
        if (
          cx >= box.left &&
          cx <= box.right &&
          cy >= box.top &&
          cy <= box.bottom
        ) {
          cell.classList.add(SELECTED_CLASS);
        }
      });
    };

    const onPointerDown = (e: PointerEvent) => {
      if (root.getAttribute("contenteditable") === "false") return;
      const cell = cellOf(e.target as Node);
      if (!cell) {
        clear();
        anchorCell = null;
        return;
      }
      if (e.shiftKey && anchorCell) {
        // Extend the rectangle from the existing anchor.
        e.preventDefault();
        window.getSelection()?.removeAllRanges();
        highlight(anchorCell, cell);
        return;
      }
      // Plain press — drop any old selection, arm a potential drag.
      clear();
      anchorCell = cell;
      dragging = false;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!anchorCell || (e.buttons & 1) === 0) return;
      const cell = cellOf(e.target as Node);
      if (!cell) return;
      if (cell !== anchorCell) dragging = true;
      if (dragging) {
        // Suppress the native text selection that a drag would start.
        e.preventDefault();
        window.getSelection()?.removeAllRanges();
        highlight(anchorCell, cell);
      }
    };

    const onPointerUp = () => {
      dragging = false;
    };

    // Typing collapses the cell-range selection back to a caret.
    const onKeyDown = () => clear();

    root.addEventListener("pointerdown", onPointerDown);
    root.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    root.addEventListener("keydown", onKeyDown);
    return () => {
      root.removeEventListener("pointerdown", onPointerDown);
      root.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      root.removeEventListener("keydown", onKeyDown);
      clear();
    };
  }, [editor]);

  return null;
}
