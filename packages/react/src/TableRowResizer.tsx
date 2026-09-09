/**
 * TableRowResizer — drag-handle overlay for resizing table rows.
 * The row counterpart of TableColumnResizer (§10).
 *
 * Render it once alongside the editor. When the caret is in a table it
 * draws a thin horizontal handle over the bottom border of each table
 * row. Dragging a handle live-previews the new row height via inline
 * `style.height` on the row's cells; on release it dispatches
 * `setRowHeight`, which writes the `rowheight` attr through the table
 * model.
 *
 * Row indexing: the JSON has no `<tbody>` level — a table is a flat list
 * of rows. So the logical row index is the index of a `<tr>` among
 * `table.querySelectorAll("tr")`, which flattens any rendered `<tbody>`.
 *
 * Like the other overlays this is a fixed-position layer measured from
 * `getBoundingClientRect()`, kept aligned on update / scroll / resize.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { EditorInstance } from "@smeditor/core";

const MIN_ROW_HEIGHT = 24;

export interface TableRowResizerProps {
  editor: EditorInstance | null;
}

interface Border {
  /** Viewport y of the border. */
  y: number;
  /** Logical row index above the border. */
  row: number;
}

interface Geometry {
  tableIndex: number;
  left: number;
  width: number;
  borders: Border[];
}

interface DragState {
  row: number;
  tableIndex: number;
  startY: number;
  startHeight: number;
  cells: HTMLElement[];
}

export function TableRowResizer({ editor }: TableRowResizerProps) {
  const [geom, setGeom] = useState<Geometry | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const measure = useCallback((): Geometry | null => {
    if (!editor) return null;
    if (typeof editor.commands.setRowHeight !== "function") return null;
    const root = editor.element;
    if (!root || root.getAttribute("contenteditable") === "false") return null;
    if (!editor.isActive("table")) return null;
    const idx = editor.getSelection()?.anchor.path[0] ?? -1;
    const table = idx >= 0 ? root.children[idx] : null;
    if (!(table instanceof HTMLTableElement)) return null;

    // Flatten any rendered <tbody> — the JSON has no tbody level, so the
    // logical row index is the position among all <tr>.
    const rows = Array.from(table.querySelectorAll("tr"));
    if (rows.length === 0) return null;

    const tableRect = table.getBoundingClientRect();
    const borders: Border[] = [];
    // Internal borders only — skip the table's bottom edge.
    for (let i = 0; i < rows.length - 1; i++) {
      const r = rows[i].getBoundingClientRect();
      borders.push({ y: r.bottom, row: i });
    }
    return {
      tableIndex: idx,
      left: tableRect.left,
      width: tableRect.width,
      borders,
    };
  }, [editor]);

  const refresh = useCallback(() => setGeom(measure()), [measure]);

  useEffect(() => {
    if (!editor) return;
    refresh();
    const offSel = editor.on("selectionUpdate", refresh);
    const offUpd = editor.on("update", refresh);
    window.addEventListener("scroll", refresh, true);
    window.addEventListener("resize", refresh);
    return () => {
      offSel?.();
      offUpd?.();
      window.removeEventListener("scroll", refresh, true);
      window.removeEventListener("resize", refresh);
    };
  }, [editor, refresh]);

  // Pointer drag — module-level listeners so the drag continues even if
  // the pointer leaves the handle.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const next = Math.max(
        MIN_ROW_HEIGHT,
        drag.startHeight + (e.clientY - drag.startY),
      );
      // Live preview — height on every cell of the row.
      for (const cell of drag.cells) {
        cell.style.height = `${Math.round(next)}px`;
      }
    };
    const onUp = () => {
      const drag = dragRef.current;
      if (!drag || !editor) return;
      const finalHeight = drag.cells[0]?.getBoundingClientRect().height ?? 0;
      dragRef.current = null;
      document.body.style.removeProperty("cursor");
      editor.commands.setRowHeight?.({
        tableIndex: drag.tableIndex,
        row: drag.row,
        height: Math.round(finalHeight),
      });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [editor]);

  if (!editor || !geom) return null;

  const startDrag = (border: Border) => (e: React.PointerEvent) => {
    if (!editor.element) return;
    e.preventDefault();
    const root = editor.element;
    const table = root.children[geom.tableIndex];
    if (!(table instanceof HTMLTableElement)) return;
    const rows = Array.from(table.querySelectorAll("tr"));
    const refRow = rows[border.row];
    if (!refRow) return;
    // Collect every cell in the row for the live-preview height.
    const cells: HTMLElement[] = [];
    for (const cell of Array.from(refRow.children)) {
      if (cell instanceof HTMLElement) cells.push(cell);
    }
    if (cells.length === 0) return;
    dragRef.current = {
      row: border.row,
      tableIndex: geom.tableIndex,
      startY: e.clientY,
      startHeight: refRow.getBoundingClientRect().height,
      cells,
    };
    document.body.style.cursor = "row-resize";
  };

  return (
    <>
      {geom.borders.map((border) => (
        <span
          key={border.row}
          className="smeditor-row-resizer"
          style={{
            position: "fixed",
            top: border.y - 3,
            left: geom.left,
            width: geom.width,
            height: 7,
            zIndex: 900,
          }}
          onPointerDown={startDrag(border)}
        />
      ))}
    </>
  );
}
