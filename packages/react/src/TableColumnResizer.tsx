/**
 * TableColumnResizer — drag-handle overlay for resizing table columns.
 * The column part of §10.
 *
 * Render it once inside `<EditorProvider>`. When the caret is in a
 * table it draws a thin vertical handle over each internal column
 * border. Dragging a handle live-previews the new column width via
 * inline `style.width`; on release it dispatches `setColumnWidth`,
 * which writes the `colwidth` attr through the table grid model.
 *
 * The default theme sets `table-layout: fixed`, so a per-cell width
 * pins the rendered column width.
 *
 * Limitation: handles are derived from the table row with the most
 * cells, on the assumption it has no horizontally-merged cells. In a
 * table whose every row has a colspan, border detection is
 * approximate — resize from a plain row for best results.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditorContext } from "./Editor.js";

const MIN_COL_WIDTH = 40;

interface Border {
  /** Viewport x of the border. */
  x: number;
  /** Visual column index to the left of the border. */
  col: number;
}

interface Geometry {
  tableIndex: number;
  top: number;
  height: number;
  borders: Border[];
}

interface DragState {
  col: number;
  tableIndex: number;
  startX: number;
  startWidth: number;
  cells: HTMLElement[];
}

export function TableColumnResizer() {
  const editor = useEditorContext();
  const [geom, setGeom] = useState<Geometry | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const measure = useCallback((): Geometry | null => {
    if (!editor) return null;
    const root = editor.element;
    if (!root || root.getAttribute("contenteditable") === "false") return null;
    if (!editor.isActive("table")) return null;
    const idx = editor.getSelection()?.anchor.path[0] ?? -1;
    const table = idx >= 0 ? root.children[idx] : null;
    if (!(table instanceof HTMLTableElement)) return null;

    // Use the row with the most cells as the column reference.
    const rows = Array.from(table.querySelectorAll("tr"));
    let refRow: HTMLTableRowElement | null = null;
    for (const row of rows) {
      if (!refRow || row.children.length > refRow.children.length) {
        refRow = row as HTMLTableRowElement;
      }
    }
    if (!refRow) return null;

    const tableRect = table.getBoundingClientRect();
    const cells = Array.from(refRow.children);
    const borders: Border[] = [];
    // Internal borders only — skip the table's right edge.
    for (let i = 0; i < cells.length - 1; i++) {
      const r = cells[i].getBoundingClientRect();
      borders.push({ x: r.right, col: i });
    }
    return {
      tableIndex: idx,
      top: tableRect.top,
      height: tableRect.height,
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

  // Pointer drag.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const next = Math.max(
        MIN_COL_WIDTH,
        drag.startWidth + (e.clientX - drag.startX),
      );
      // Live preview — width on every cell of the column.
      for (const cell of drag.cells) {
        cell.style.width = `${Math.round(next)}px`;
      }
    };
    const onUp = () => {
      const drag = dragRef.current;
      if (!drag || !editor) return;
      const finalWidth = drag.cells[0]?.getBoundingClientRect().width ?? 0;
      dragRef.current = null;
      document.body.style.removeProperty("cursor");
      editor.commands.setColumnWidth?.({
        tableIndex: drag.tableIndex,
        col: drag.col,
        width: Math.round(finalWidth),
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
    // Collect the cell at column `border.col` in every row for preview.
    const cells: HTMLElement[] = [];
    for (const row of Array.from(table.querySelectorAll("tr"))) {
      const cell = row.children[border.col];
      if (cell instanceof HTMLElement) cells.push(cell);
    }
    if (cells.length === 0) return;
    dragRef.current = {
      col: border.col,
      tableIndex: geom.tableIndex,
      startX: e.clientX,
      startWidth: cells[0].getBoundingClientRect().width,
      cells,
    };
    document.body.style.cursor = "col-resize";
  };

  return (
    <>
      {geom.borders.map((border) => (
        <span
          key={border.col}
          className="smeditor-col-resizer"
          style={{
            position: "fixed",
            top: geom.top,
            left: border.x - 3,
            width: 7,
            height: geom.height,
            zIndex: 900,
          }}
          onPointerDown={startDrag(border)}
        />
      ))}
    </>
  );
}
