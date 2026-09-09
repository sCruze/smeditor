/**
 * @smeditor/extension-table
 *
 * Tables — the §10 module. Three nodes (`table`, `table_row`,
 * `table_cell`) plus structural commands.
 *
 * Span awareness (new in v0.0.2): every structural command runs
 * against the visual grid built by `./table-map`, so `colspan` /
 * `rowspan` cells behave correctly — adding a column widens spanning
 * cells instead of shifting the grid out of alignment, merge / split
 * work, and so on.
 *
 * Selection note: the editor's selection model is top-level-indexed,
 * so the commands locate the active `<td>`/`<th>` through the live
 * DOM (`getSelection()` + `closest`) and translate that into a
 * logical `CellRef`. The DOM `<tr>` index is the visual row index and
 * the `<td>` index within it is the logical cell index — together
 * they're exactly a `CellRef`.
 */

import type {
  Extension,
  EditorInstance,
  DocumentNode,
  DocumentJSON,
  DOMOutputSpec,
} from "@smeditor/core";
import {
  cloneDoc,
  descendToLeafPath,
  nodeAt,
  sanitizeCSSColor,
} from "@smeditor/core";
import {
  buildTableMap,
  cellAt,
  rectOf,
  addColumnAt,
  removeColumnAt,
  addRowAt,
  removeRowAt,
  mergeRight,
  mergeDown,
  splitCell as splitCellInMap,
  mergeCellRange,
  setColumnWidth as setColumnWidthInMap,
  type CellRef,
} from "./table-map.js";

// ============================================================================
// Node specs
// ============================================================================

type CellAlign = "left" | "center" | "right" | "justify";

const CELL_ALIGNS: ReadonlySet<CellAlign> = new Set([
  "left",
  "center",
  "right",
  "justify",
]);

function sanitizeColor(raw: unknown): string | null {
  return sanitizeCSSColor(raw);
}

function sanitizeAlign(raw: unknown): CellAlign | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase();
  return CELL_ALIGNS.has(value as CellAlign) ? (value as CellAlign) : null;
}

function styleDeclaration(style: string, name: string): string | null {
  const match = new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`, "i").exec(
    style,
  );
  return match?.[1]?.trim() ?? null;
}

function setCellAttr(
  cell: DocumentNode,
  key: string,
  value: string | number | boolean | null,
): boolean {
  const current = cell.attrs?.[key] ?? null;
  if (current === value) return false;

  if (value === null) {
    if (!cell.attrs || !(key in cell.attrs)) return false;
    const next = { ...cell.attrs };
    delete next[key];
    if (Object.keys(next).length === 0) delete cell.attrs;
    else cell.attrs = next;
    return true;
  }

  cell.attrs = { ...(cell.attrs ?? {}), [key]: value };
  return true;
}

function refKey(ref: CellRef): string {
  return `${ref.rowIndex}:${ref.cellIndex}`;
}

function activeCell(
  table: DocumentNode,
  visual: { row: number; col: number },
): DocumentNode | null {
  const map = buildTableMap(table);
  const ref = cellAt(map, visual.row, visual.col);
  return ref
    ? table.content?.[ref.rowIndex]?.content?.[ref.cellIndex] ?? null
    : null;
}

function columnCells(table: DocumentNode, col: number): DocumentNode[] {
  const map = buildTableMap(table);
  const cells: DocumentNode[] = [];
  const seen = new Set<string>();

  for (let row = 0; row < map.height; row++) {
    const ref = cellAt(map, row, col);
    if (!ref) continue;
    const key = refKey(ref);
    if (seen.has(key)) continue;
    seen.add(key);
    const cell = table.content?.[ref.rowIndex]?.content?.[ref.cellIndex];
    if (cell) cells.push(cell);
  }

  return cells;
}

function cellAttrs(el: HTMLElement, header: boolean): Record<string, unknown> {
  const out: Record<string, unknown> = { header };
  const colspan = Number(el.getAttribute("colspan") ?? "1");
  const rowspan = Number(el.getAttribute("rowspan") ?? "1");
  if (colspan > 1) out.colspan = colspan;
  if (rowspan > 1) out.rowspan = rowspan;
  const style = el.getAttribute("style") ?? "";
  const w = /(?:^|;)\s*width\s*:\s*(\d+(?:\.\d+)?)px/i.exec(style);
  if (w) out.colwidth = Math.round(Number(w[1]));
  const backgroundColor = sanitizeColor(
    styleDeclaration(style, "background-color") ??
      styleDeclaration(style, "background"),
  );
  if (backgroundColor) out.backgroundColor = backgroundColor;
  const textAlign = sanitizeAlign(styleDeclaration(style, "text-align"));
  if (textAlign) out.textAlign = textAlign;
  return out;
}

function cellToDOM(node: DocumentNode): DOMOutputSpec {
  const header = Boolean(node.attrs?.header);
  const tag = header ? "th" : "td";
  const attrs: Record<string, string | number | boolean> = {};
  const colspan = Number(node.attrs?.colspan ?? 1);
  const rowspan = Number(node.attrs?.rowspan ?? 1);
  if (colspan > 1) attrs.colspan = colspan;
  if (rowspan > 1) attrs.rowspan = rowspan;
  const style: string[] = [];
  const colwidth = Number(node.attrs?.colwidth ?? 0);
  if (colwidth > 0) style.push(`width: ${Math.round(colwidth)}px`);
  const backgroundColor = sanitizeColor(node.attrs?.backgroundColor);
  if (backgroundColor) style.push(`background-color: ${backgroundColor}`);
  const textAlign = sanitizeAlign(node.attrs?.textAlign);
  if (textAlign) style.push(`text-align: ${textAlign}`);
  if (style.length > 0) attrs.style = style.join("; ");
  return Object.keys(attrs).length ? [tag, attrs, 0] : [tag, 0];
}

const tableNode = {
  name: "table",
  group: "block" as const,
  content: "table_row+",
  toDOM: (): DOMOutputSpec => ["table", { class: "smeditor-table" }, 0],
  parseDOM: [{ tag: "table" }],
};

function sanitizeRowHeight(raw: unknown): number | null {
  const n = Math.round(Number(raw));
  return Number.isFinite(n) && n >= 8 && n <= 2000 ? n : null;
}

const tableRowNode = {
  name: "table_row",
  group: "block" as const,
  content: "table_cell+",
  attrs: { rowheight: { default: null } },
  toDOM: (node: DocumentNode): DOMOutputSpec => {
    const h = sanitizeRowHeight(node.attrs?.rowheight);
    return h ? ["tr", { style: `height: ${h}px` }, 0] : ["tr", 0];
  },
  parseDOM: [
    {
      tag: "tr",
      getAttrs: (el: HTMLElement) => {
        const style = el.getAttribute("style") ?? "";
        const m = /(?:^|;)\s*height\s*:\s*(\d+(?:\.\d+)?)px/i.exec(style);
        const h = m ? sanitizeRowHeight(m[1]) : null;
        return h ? { rowheight: h } : null;
      },
    },
  ],
};

const tableCellNode = {
  name: "table_cell",
  group: "block" as const,
  content: "block+",
  attrs: {
    header: { default: false },
    colspan: { default: 1 },
    rowspan: { default: 1 },
    colwidth: { default: null },
  },
  toDOM: cellToDOM,
  parseDOM: [
    { tag: "td", getAttrs: (el: HTMLElement) => cellAttrs(el, false) },
    { tag: "th", getAttrs: (el: HTMLElement) => cellAttrs(el, true) },
  ],
};

// ============================================================================
// Cell construction (used only by insertTable)
// ============================================================================

function emptyCell(header = false): DocumentNode {
  const cell: DocumentNode = {
    type: "table_cell",
    content: [{ type: "paragraph" }],
  };
  if (header) cell.attrs = { header: true };
  return cell;
}

function emptyRow(cols: number, header = false): DocumentNode {
  return {
    type: "table_row",
    content: Array.from({ length: cols }, () => emptyCell(header)),
  };
}

// ============================================================================
// DOM-side cell location
// ============================================================================

interface CellContext {
  /** Index of the table among the document's top-level blocks. */
  tableIndex: number;
  /** The logical cell the caret is in. */
  ref: CellRef;
}

function findCellContext(editor: EditorInstance): CellContext | null {
  if (typeof window === "undefined") return null;
  const root = editor.element;
  if (!root) return null;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;

  let node: Node | null = sel.anchorNode;
  let cell: Element | null = null;
  while (node && node !== root) {
    if (node.nodeType === 1) {
      const tag = (node as Element).tagName.toLowerCase();
      if (tag === "td" || tag === "th") {
        cell = node as Element;
        break;
      }
    }
    node = node.parentNode;
  }
  if (!cell) return null;

  const tr = cell.closest("tr");
  const table = cell.closest("table");
  if (!tr || !table) return null;

  const cellIndex = Array.from(tr.children).indexOf(cell);
  const rowIndex = Array.from(table.querySelectorAll("tr")).indexOf(tr);
  const tableIndex = Array.from(root.children).indexOf(table);
  if (tableIndex < 0 || rowIndex < 0 || cellIndex < 0) return null;

  return { tableIndex, ref: { rowIndex, cellIndex } };
}

function caretAt(idx: number) {
  return {
    anchor: { path: [idx], offset: 0 },
    head: { path: [idx], offset: 0 },
  };
}

/** A collapsed selection at the start of `path`. */
function caretPath(path: number[]) {
  return {
    anchor: { path, offset: 0 },
    head: { path, offset: 0 },
  };
}

/**
 * Locate the table coordinates of a deep selection path. Returns the
 * table's path, the table node, and the row / cell indices, or null
 * if the path doesn't run through a table.
 */
function cellCoords(
  doc: DocumentJSON,
  path: number[],
): {
  tablePath: number[];
  table: DocumentNode;
  rowIndex: number;
  cellIndex: number;
} | null {
  for (let k = 1; k + 1 < path.length; k++) {
    const node = nodeAt(doc, path.slice(0, k));
    if (node?.type === "table") {
      return {
        tablePath: path.slice(0, k),
        table: node,
        rowIndex: path[k],
        cellIndex: path[k + 1],
      };
    }
  }
  return null;
}

/**
 * The leaf-block path of the cell after the current one — next cell
 * in the row, or the first cell of the next row. Returns null at the
 * last cell of the table.
 */
function nextCellLeaf(doc: DocumentJSON, path: number[]): number[] | null {
  const c = cellCoords(doc, path);
  if (!c) return null;
  const rows = c.table.content ?? [];
  const cells = rows[c.rowIndex]?.content ?? [];
  let row = c.rowIndex;
  let cell = c.cellIndex + 1;
  if (cell >= cells.length) {
    row += 1;
    cell = 0;
  }
  if (row >= rows.length) return null;
  return descendToLeafPath(doc, [...c.tablePath, row, cell]);
}

/** The leaf-block path of the cell before the current one, or null. */
function prevCellLeaf(doc: DocumentJSON, path: number[]): number[] | null {
  const c = cellCoords(doc, path);
  if (!c) return null;
  const rows = c.table.content ?? [];
  let row = c.rowIndex;
  let cell = c.cellIndex - 1;
  if (cell < 0) {
    row -= 1;
    if (row < 0) return null;
    cell = (rows[row]?.content?.length ?? 0) - 1;
  }
  if (cell < 0) return null;
  return descendToLeafPath(doc, [...c.tablePath, row, cell]);
}

/**
 * Shared command body: locate the table + active cell, clone the doc,
 * compute the cell's visual rectangle, hand it to `mutate`, dispatch.
 */
function withCell(
  editor: EditorInstance,
  mutate: (
    table: DocumentNode,
    visual: { row: number; col: number; rectRight: number; rectBottom: number },
  ) => boolean,
): boolean {
  const sourceDoc = editor.getJSON();
  let ctx = findCellContext(editor);

  // Structural table tools are often triggered from toolbar buttons.
  // In that moment the browser selection may already have moved to the
  // button, especially in React playgrounds. Fall back to SMEditor's
  // own deep selection, which is enough to locate the active table cell.
  if (!ctx) {
    const sel = editor.getSelection();
    const coords = sel ? cellCoords(sourceDoc, sel.anchor.path) : null;
    if (coords && coords.tablePath.length === 1) {
      ctx = {
        tableIndex: coords.tablePath[0],
        ref: { rowIndex: coords.rowIndex, cellIndex: coords.cellIndex },
      };
    }
  }

  if (!ctx) return false;
  const doc: DocumentJSON = cloneDoc(sourceDoc);
  const table = doc.content[ctx.tableIndex];
  if (!table || table.type !== "table" || !table.content) return false;

  const map = buildTableMap(table);
  const rect = rectOf(map, ctx.ref);
  if (!rect) return false;

  const changed = mutate(table, {
    row: rect.top,
    col: rect.left,
    rectRight: rect.right,
    rectBottom: rect.bottom,
  });
  if (!changed) return false;

  // Keep the caret in the cell the command acted on. Resetting to the
  // table's top-level index made a deep selection normalise to the
  // *first* cell, so a follow-up cell command (toggle header column, set
  // background/align) silently retargeted the wrong column. When the
  // table survives and deep selection is on, point the caret back at the
  // active cell's leaf block — clamped, since structural commands may
  // have removed the row/column the caret was in.
  let selection = caretAt(ctx.tableIndex);
  if ((editor.options.deepSelection ?? false) && table.type === "table") {
    const rows = table.content ?? [];
    const rowIdx = Math.min(ctx.ref.rowIndex, rows.length - 1);
    const cells = rows[rowIdx]?.content ?? [];
    const cellIdx = Math.min(ctx.ref.cellIndex, cells.length - 1);
    if (rowIdx >= 0 && cellIdx >= 0) {
      selection = caretPath(
        descendToLeafPath(doc, [ctx.tableIndex, rowIdx, cellIdx]),
      );
    }
  }

  // If the table emptied out, the mutator converts it to a paragraph and
  // `table.type` is no longer "table", so the caret falls back to the
  // top-level index above.
  editor.dispatch({
    doc,
    selection,
    addToHistory: true,
  });
  return true;
}

// ============================================================================
// Extension
// ============================================================================

export interface InsertTableOptions {
  rows?: number;
  cols?: number;
  withHeaderRow?: boolean;
}

export const TableExtension: Extension = {
  name: "table",
  nodes: [tableNode, tableRowNode, tableCellNode],
  commands: {
    /** insertTable({ rows, cols, withHeaderRow }) — default 3×3 + header. */
    insertTable:
      (opts: InsertTableOptions = {}) =>
      (editor: EditorInstance): boolean => {
        const rows = Math.max(1, Math.min(opts.rows ?? 3, 20));
        const cols = Math.max(1, Math.min(opts.cols ?? 3, 20));
        const withHeaderRow = opts.withHeaderRow ?? true;

        const tableRows: DocumentNode[] = [];
        for (let r = 0; r < rows; r++) {
          tableRows.push(emptyRow(cols, withHeaderRow && r === 0));
        }
        const table: DocumentNode = { type: "table", content: tableRows };
        const trailing: DocumentNode = { type: "paragraph" };

        const sel = editor.getSelection();
        const idx = sel?.anchor.path[0] ?? 0;
        const doc = cloneDoc(editor.getJSON());

        const current = doc.content[idx];
        const currentEmpty =
          current &&
          (!current.content ||
            current.content.length === 0 ||
            (current.content.length === 1 &&
              current.content[0].type === "text" &&
              (current.content[0].text ?? "") === ""));

        let caretIdx: number;
        if (currentEmpty) {
          doc.content.splice(idx, 1, table, trailing);
          caretIdx = idx;
        } else {
          doc.content.splice(idx + 1, 0, table, trailing);
          caretIdx = idx + 1;
        }
        editor.dispatch({
          doc,
          selection: caretAt(caretIdx),
          addToHistory: true,
        });
        return true;
      },

    // ---- Rows ----------------------------------------------------------
    addRowBefore: () => (editor) =>
      withCell(editor, (table, v) => {
        addRowAt(table, v.row);
        return true;
      }),
    addRowAfter: () => (editor) =>
      withCell(editor, (table, v) => {
        addRowAt(table, v.rectBottom);
        return true;
      }),
    deleteRow: () => (editor) =>
      withCell(editor, (table, v) => {
        removeRowAt(table, v.row);
        if ((table.content?.length ?? 0) === 0) {
          table.type = "paragraph";
          delete table.content;
        }
        return true;
      }),

    // ---- Columns -------------------------------------------------------
    addColumnBefore: () => (editor) =>
      withCell(editor, (table, v) => {
        addColumnAt(table, v.col);
        return true;
      }),
    addColumnAfter: () => (editor) =>
      withCell(editor, (table, v) => {
        addColumnAt(table, v.rectRight);
        return true;
      }),
    deleteColumn: () => (editor) =>
      withCell(editor, (table, v) => {
        removeColumnAt(table, v.col);
        const empty =
          !table.content ||
          table.content.every((row) => (row.content?.length ?? 0) === 0);
        if (empty) {
          table.type = "paragraph";
          delete table.content;
        }
        return true;
      }),

    // ---- Merge / split -------------------------------------------------
    mergeCellRight: () => (editor) =>
      withCell(editor, (table, v) => mergeRight(table, v.row, v.col)),
    mergeCellDown: () => (editor) =>
      withCell(editor, (table, v) => mergeDown(table, v.row, v.col)),
    splitCell: () => (editor) =>
      withCell(editor, (table, v) => splitCellInMap(table, v.row, v.col)),

    /**
     * mergeCells() — merge whatever cell range is currently selected.
     * The cell-range UI marks cells with the
     * `smeditor-cell--selected` class; this reads that range out of
     * the DOM, turns it into a visual rectangle through the grid
     * model, and merges it. Returns false if fewer than two cells are
     * selected or the rectangle is ragged.
     */
    mergeCells:
      () =>
      (editor: EditorInstance): boolean => {
        if (typeof window === "undefined") return false;
        const root = editor.element;
        if (!root) return false;
        const selected = Array.from(
          root.querySelectorAll(
            "td.smeditor-cell--selected, th.smeditor-cell--selected",
          ),
        );
        if (selected.length < 2) return false;

        const tableEl = selected[0].closest("table");
        if (!tableEl) return false;
        const tableIndex = Array.from(root.children).indexOf(tableEl);
        if (tableIndex < 0) return false;

        // DOM cells → logical CellRefs.
        const allRows = Array.from(tableEl.querySelectorAll("tr"));
        const refs: CellRef[] = [];
        for (const cell of selected) {
          const tr = cell.closest("tr");
          if (!tr) continue;
          const rowIndex = allRows.indexOf(tr);
          const cellIndex = Array.from(tr.children).indexOf(cell);
          if (rowIndex >= 0 && cellIndex >= 0) {
            refs.push({ rowIndex, cellIndex });
          }
        }
        if (refs.length < 2) return false;

        const doc = cloneDoc(editor.getJSON());
        const table = doc.content[tableIndex];
        if (!table || table.type !== "table" || !table.content) return false;

        // Bounding visual rectangle of the selected cells.
        const map = buildTableMap(table);
        let top = Infinity;
        let left = Infinity;
        let bottom = -Infinity;
        let right = -Infinity;
        for (const ref of refs) {
          const r = rectOf(map, ref);
          if (!r) continue;
          top = Math.min(top, r.top);
          left = Math.min(left, r.left);
          bottom = Math.max(bottom, r.bottom);
          right = Math.max(right, r.right);
        }
        if (top === Infinity) return false;

        if (!mergeCellRange(table, { top, left, bottom, right })) return false;
        editor.dispatch({
          doc,
          selection: caretAt(tableIndex),
          addToHistory: true,
        });
        return true;
      },

    // ---- Whole-table ---------------------------------------------------
    deleteTable: () => (editor) =>
      withCell(editor, (table) => {
        table.type = "paragraph";
        delete table.content;
        delete table.attrs;
        return true;
      }),

    setCellBackground:
      (opts: { color?: string | null } = {}) =>
      (editor: EditorInstance): boolean =>
        withCell(editor, (table, v) => {
          const cell = activeCell(table, v);
          if (!cell) return false;
          return setCellAttr(
            cell,
            "backgroundColor",
            sanitizeColor(opts.color ?? null),
          );
        }),
    setCellAlign:
      (opts: { align?: CellAlign | null } = {}) =>
      (editor: EditorInstance): boolean =>
        withCell(editor, (table, v) => {
          const cell = activeCell(table, v);
          if (!cell) return false;
          return setCellAttr(
            cell,
            "textAlign",
            sanitizeAlign(opts.align ?? null),
          );
        }),

    /**
     * setColumnWidth({ tableIndex, col, width }) — set a column's
     * pixel width. `tableIndex` is the table's top-level block index;
     * `col` is a visual column index. Used by the column-resize UI.
     */
    setColumnWidth:
      (opts: { tableIndex: number; col: number; width: number }) =>
      (editor: EditorInstance): boolean => {
        const doc = cloneDoc(editor.getJSON());
        const table = doc.content[opts?.tableIndex ?? -1];
        if (!table || table.type !== "table" || !table.content) return false;
        setColumnWidthInMap(table, opts.col, opts.width);
        editor.dispatch({
          doc,
          selection: editor.getSelection() ?? caretAt(opts.tableIndex),
          addToHistory: true,
        });
        return true;
      },

    /**
     * setRowHeight({ tableIndex, row, height }) — set a row's pixel
     * height. `tableIndex` is the table's top-level block index; `row`
     * is the logical row index. Used by the row-resize UI.
     */
    setRowHeight:
      (opts: { tableIndex: number; row: number; height: number }) =>
      (editor: EditorInstance): boolean => {
        const doc = cloneDoc(editor.getJSON());
        const table = doc.content[opts?.tableIndex ?? -1];
        if (!table || table.type !== "table" || !table.content) return false;
        const row = table.content[opts.row];
        if (!row) return false;
        const h = sanitizeRowHeight(opts.height);
        if (!setCellAttr(row, "rowheight", h)) return false;
        editor.dispatch({
          doc,
          selection: editor.getSelection() ?? caretAt(opts.tableIndex),
          addToHistory: true,
        });
        return true;
      },
    toggleHeaderRow: () => (editor) =>
      withCell(editor, (table) => {
        const firstRow = table.content?.[0];
        if (!firstRow?.content) return false;
        const makeHeader = !firstRow.content[0]?.attrs?.header;
        let changed = false;
        for (const cell of firstRow.content) {
          changed =
            setCellAttr(cell, "header", makeHeader ? true : null) || changed;
        }
        return changed;
      }),
    toggleHeaderColumn: () => (editor) =>
      withCell(editor, (table, v) => {
        const cells = columnCells(table, v.col);
        if (cells.length === 0) return false;
        const makeHeader = !cells.every((cell) =>
          Boolean(cell.attrs?.header),
        );
        let changed = false;
        for (const cell of cells) {
          changed =
            setCellAttr(cell, "header", makeHeader ? true : null) || changed;
        }
        return changed;
      }),

    /**
     * goToNextCell — move the caret to the next table cell. Past the
     * last cell it appends a row and moves into it. Needs a deep
     * selection path; returns false outside a table.
     */
    goToNextCell:
      () =>
      (editor: EditorInstance): boolean => {
        const sel = editor.getSelection();
        if (!sel) return false;
        const doc = editor.getJSON();
        const target = nextCellLeaf(doc, sel.anchor.path);
        if (target) {
          editor.dispatch({
            doc,
            selection: caretPath(target),
            addToHistory: false,
          });
          return true;
        }
        // Past the last cell — append a row and move into it.
        const c = cellCoords(doc, sel.anchor.path);
        if (!c) return false;
        const newDoc = cloneDoc(doc);
        const table = nodeAt(newDoc, c.tablePath);
        if (!table?.content) return false;
        const newRowIndex = table.content.length;
        addRowAt(table, newRowIndex);
        const leaf = descendToLeafPath(newDoc, [
          ...c.tablePath,
          newRowIndex,
          0,
        ]);
        editor.dispatch({
          doc: newDoc,
          selection: caretPath(leaf),
          addToHistory: true,
        });
        return true;
      },

    /** goToPrevCell — move the caret to the previous table cell. */
    goToPrevCell:
      () =>
      (editor: EditorInstance): boolean => {
        const sel = editor.getSelection();
        if (!sel) return false;
        const doc = editor.getJSON();
        const target = prevCellLeaf(doc, sel.anchor.path);
        if (!target) return false;
        editor.dispatch({
          doc,
          selection: caretPath(target),
          addToHistory: false,
        });
        return true;
      },
  },
  keyboardShortcuts: {
    // Tab / Shift-Tab navigate cells when the caret is in a table.
    // Outside a table the commands return false, so a later extension
    // (indent) handles Tab instead.
    Tab: (editor: EditorInstance): boolean =>
      editor.commands.goToNextCell?.() ?? false,
    "Shift-Tab": (editor: EditorInstance): boolean =>
      editor.commands.goToPrevCell?.() ?? false,
  },
};

export default TableExtension;

// Re-export the grid model for apps that want to inspect tables.
export { buildTableMap, cellAt, rectOf };
export type { TableMap, CellRef, CellRect } from "./table-map.js";

/** Test-only access to the pure cell-navigation helpers. */
export const __test = { nextCellLeaf, prevCellLeaf };
