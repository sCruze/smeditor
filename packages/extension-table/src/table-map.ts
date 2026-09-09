/**
 * Table grid model.
 *
 * A table's JSON is a list of *logical* rows, each a list of *logical*
 * cells. Once cells carry `colspan` / `rowspan`, that logical shape no
 * longer matches the *visual* grid the user sees — a 2-colspan cell is
 * one logical cell but two visual columns.
 *
 * `TableMap` builds the visual grid: for every (row, col) coordinate
 * it records which logical cell occupies it. Every structural command
 * — add/remove column or row, merge, split — is expressed against the
 * visual grid through this map, so spans are handled correctly.
 *
 * This module is pure: functions take a `table` DocumentNode and
 * mutate it (or its clone — the caller clones first). No DOM, no
 * editor. That makes the whole thing unit-testable, which matters a
 * lot for table logic.
 */

import type { DocumentNode } from "@smeditor/core";

// ============================================================================
// Types
// ============================================================================

export interface CellRef {
  /** Index of the row in `table.content`. */
  rowIndex: number;
  /** Index of the cell within that row's `content`. */
  cellIndex: number;
}

export interface CellRect {
  /** Inclusive top visual row. */
  top: number;
  /** Inclusive left visual column. */
  left: number;
  /** Exclusive bottom visual row. */
  bottom: number;
  /** Exclusive right visual column. */
  right: number;
}

export interface TableMap {
  /** Number of visual columns. */
  width: number;
  /** Number of visual rows. */
  height: number;
  /** grid[row][col] — the logical cell covering this visual cell. */
  grid: (CellRef | null)[][];
}

// ============================================================================
// Build
// ============================================================================

function span(cell: DocumentNode, key: "colspan" | "rowspan"): number {
  const v = Number(cell.attrs?.[key] ?? 1);
  return Number.isFinite(v) && v >= 1 ? Math.floor(v) : 1;
}

/**
 * Build the visual grid for a table node.
 *
 * Cells are laid out left-to-right, top-to-bottom; a cell claims
 * `colspan × rowspan` visual cells starting at the first free column
 * in its row. A `rowspan` cell pre-occupies cells in the rows below,
 * so later rows skip past them.
 */
export function buildTableMap(table: DocumentNode): TableMap {
  const rows = table.content ?? [];
  const height = rows.length;
  const grid: (CellRef | null)[][] = rows.map(() => []);
  let width = 0;

  for (let r = 0; r < height; r++) {
    const cells = rows[r].content ?? [];
    let col = 0;
    for (let ci = 0; ci < cells.length; ci++) {
      const cell = cells[ci];
      const colspan = span(cell, "colspan");
      const rowspan = span(cell, "rowspan");
      // Skip columns already claimed by a rowspan from a row above.
      while (grid[r][col]) col++;
      const ref: CellRef = { rowIndex: r, cellIndex: ci };
      for (let dr = 0; dr < rowspan && r + dr < height; dr++) {
        for (let dc = 0; dc < colspan; dc++) {
          grid[r + dr][col + dc] = ref;
        }
      }
      col += colspan;
    }
    width = Math.max(width, grid[r].length);
  }

  // Pad every row to the full width so lookups never go out of bounds.
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (grid[r][c] === undefined) grid[r][c] = null;
    }
  }

  return { width, height, grid };
}

/** The logical cell at a visual coordinate, or null. */
export function cellAt(
  map: TableMap,
  row: number,
  col: number,
): CellRef | null {
  return map.grid[row]?.[col] ?? null;
}

/** The visual rectangle a logical cell occupies, or null if absent. */
export function rectOf(map: TableMap, ref: CellRef): CellRect | null {
  let top = Infinity;
  let left = Infinity;
  let bottom = -Infinity;
  let right = -Infinity;
  for (let r = 0; r < map.height; r++) {
    for (let c = 0; c < map.width; c++) {
      const cell = map.grid[r][c];
      if (cell && cell.rowIndex === ref.rowIndex && cell.cellIndex === ref.cellIndex) {
        top = Math.min(top, r);
        left = Math.min(left, c);
        bottom = Math.max(bottom, r + 1);
        right = Math.max(right, c + 1);
      }
    }
  }
  if (top === Infinity) return null;
  return { top, left, bottom, right };
}

// ============================================================================
// Cell construction
// ============================================================================

function emptyCell(header = false): DocumentNode {
  const cell: DocumentNode = {
    type: "table_cell",
    content: [{ type: "paragraph" }],
  };
  if (header) cell.attrs = { header: true };
  return cell;
}

function isHeaderRow(row: DocumentNode): boolean {
  return Boolean(row.content?.[0]?.attrs?.header);
}

function setSpan(cell: DocumentNode, key: "colspan" | "rowspan", value: number): void {
  if (value <= 1) {
    if (cell.attrs) {
      delete cell.attrs[key];
      if (Object.keys(cell.attrs).length === 0) delete cell.attrs;
    }
  } else {
    cell.attrs = { ...(cell.attrs ?? {}), [key]: value };
  }
}

// ============================================================================
// Column operations
// ============================================================================

/**
 * Insert a column at visual position `at` (0..width). Cells that span
 * across the insertion line are widened; everything else gets a fresh
 * cell.
 */
export function addColumnAt(table: DocumentNode, at: number): void {
  const map = buildTableMap(table);
  const rows = table.content ?? [];
  const widened = new Set<string>();

  for (let r = 0; r < map.height; r++) {
    const before = at > 0 ? cellAt(map, r, at - 1) : null;
    const here = at < map.width ? cellAt(map, r, at) : null;

    // A cell straddles the line when the same logical cell sits on
    // both sides of it — widen it once.
    if (before && here && refEq(before, here)) {
      const key = refKey(before);
      if (!widened.has(key)) {
        widened.add(key);
        const cell = rows[before.rowIndex].content![before.cellIndex];
        setSpan(cell, "colspan", span(cell, "colspan") + 1);
      }
      continue;
    }

    // Otherwise insert a new cell into this logical row, before the
    // cell currently at `at` (or at the end of the row).
    const row = rows[r];
    if (!row.content) row.content = [];
    const insertIndex = here ? here.cellIndex : row.content.length;
    row.content.splice(insertIndex, 0, emptyCell(isHeaderRow(row)));
  }
}

/** Remove the visual column at `at`. Spanning cells shrink instead. */
export function removeColumnAt(table: DocumentNode, at: number): void {
  const map = buildTableMap(table);
  if (at < 0 || at >= map.width) return;
  const rows = table.content ?? [];
  const shrunk = new Set<string>();
  // Collect removals per row, apply high-index-first so indices stay valid.
  const removals: { row: number; cellIndex: number }[] = [];

  for (let r = 0; r < map.height; r++) {
    const ref = cellAt(map, r, at);
    if (!ref) continue;
    const cell = rows[ref.rowIndex].content![ref.cellIndex];
    const colspan = span(cell, "colspan");
    if (colspan > 1) {
      const key = refKey(ref);
      if (!shrunk.has(key)) {
        shrunk.add(key);
        setSpan(cell, "colspan", colspan - 1);
      }
    } else {
      removals.push({ row: ref.rowIndex, cellIndex: ref.cellIndex });
    }
  }
  // De-dupe and delete.
  const seen = new Set<string>();
  removals
    .filter((x) => {
      const k = `${x.row}:${x.cellIndex}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => b.cellIndex - a.cellIndex)
    .forEach((x) => rows[x.row].content?.splice(x.cellIndex, 1));
}

// ============================================================================
// Row operations
// ============================================================================

/** Insert a row at visual position `at` (0..height). */
export function addRowAt(table: DocumentNode, at: number): void {
  const map = buildTableMap(table);
  const rows = table.content ?? [];
  const newCells: DocumentNode[] = [];
  const extended = new Set<string>();

  for (let c = 0; c < map.width; ) {
    const above = at > 0 ? cellAt(map, at - 1, c) : null;
    const here = at < map.height ? cellAt(map, at, c) : null;

    // A rowspan cell crossing the line gets taller; skip its columns.
    if (above && here && refEq(above, here)) {
      const key = refKey(above);
      if (!extended.has(key)) {
        extended.add(key);
        const cell = rows[above.rowIndex].content![above.cellIndex];
        setSpan(cell, "rowspan", span(cell, "rowspan") + 1);
      }
      const cell = rows[above.rowIndex].content![above.cellIndex];
      c += span(cell, "colspan");
      continue;
    }
    newCells.push(emptyCell());
    c += 1;
  }

  rows.splice(at, 0, { type: "table_row", content: newCells });
}

/** Remove the visual row at `at`. Rowspan cells shrink or relocate. */
export function removeRowAt(table: DocumentNode, at: number): void {
  const map = buildTableMap(table);
  if (at < 0 || at >= map.height) return;
  const rows = table.content ?? [];

  // Before deleting the row, fix up rowspan cells.
  for (let c = 0; c < map.width; c++) {
    const ref = cellAt(map, at, c);
    if (!ref) continue;
    const cell = rows[ref.rowIndex].content?.[ref.cellIndex];
    if (!cell) continue;
    const rowspan = span(cell, "rowspan");
    if (rowspan > 1) {
      if (ref.rowIndex === at) {
        // The cell *starts* in the doomed row — move it down one row,
        // shrinking the span, so its content survives.
        const moved: DocumentNode = { ...cell };
        setSpan(moved, "rowspan", rowspan - 1);
        const nextRow = rows[at + 1];
        if (nextRow) {
          if (!nextRow.content) nextRow.content = [];
          // Insert at the logical index matching the moved cell's visual
          // column (`c`), mirroring splitCell. `unshift` always prepended
          // at index 0, which jumped a non-leftmost rowspan cell to the
          // first column.
          const movedLeft = c;
          const nextMap = buildTableMap(table);
          let insertAt = nextRow.content.length;
          for (let ci = 0; ci < nextRow.content.length; ci++) {
            const rr = rectOf(nextMap, { rowIndex: at + 1, cellIndex: ci });
            if (rr && rr.left >= movedLeft) {
              insertAt = ci;
              break;
            }
          }
          nextRow.content.splice(insertAt, 0, moved);
        }
      } else {
        // The cell merely passes through — just shorten it.
        setSpan(cell, "rowspan", rowspan - 1);
      }
    }
  }
  rows.splice(at, 1);
}

// ============================================================================
// Merge / split
// ============================================================================

/**
 * Merge the cell at visual (row,col) with its right neighbour. Returns
 * false when there's no aligned neighbour (different heights can't
 * merge cleanly).
 */
export function mergeRight(table: DocumentNode, row: number, col: number): boolean {
  const map = buildTableMap(table);
  const ref = cellAt(map, row, col);
  if (!ref) return false;
  const rect = rectOf(map, ref);
  if (!rect || rect.right >= map.width) return false;

  const neighbourRef = cellAt(map, rect.top, rect.right);
  if (!neighbourRef) return false;
  const neighbourRect = rectOf(map, neighbourRef);
  if (!neighbourRect) return false;
  // Heights must line up for a clean merge.
  if (neighbourRect.top !== rect.top || neighbourRect.bottom !== rect.bottom) {
    return false;
  }

  const rows = table.content!;
  const cell = rows[ref.rowIndex].content![ref.cellIndex];
  const neighbour = rows[neighbourRef.rowIndex].content![neighbourRef.cellIndex];

  setSpan(
    cell,
    "colspan",
    span(cell, "colspan") + span(neighbour, "colspan"),
  );
  // Move the neighbour's content into the merged cell.
  cell.content = [...(cell.content ?? []), ...(neighbour.content ?? [])];
  rows[neighbourRef.rowIndex].content!.splice(neighbourRef.cellIndex, 1);
  return true;
}

/**
 * Merge the cell at visual (row,col) with the cell directly below it.
 */
export function mergeDown(table: DocumentNode, row: number, col: number): boolean {
  const map = buildTableMap(table);
  const ref = cellAt(map, row, col);
  if (!ref) return false;
  const rect = rectOf(map, ref);
  if (!rect || rect.bottom >= map.height) return false;

  const neighbourRef = cellAt(map, rect.bottom, rect.left);
  if (!neighbourRef) return false;
  const neighbourRect = rectOf(map, neighbourRef);
  if (!neighbourRect) return false;
  if (neighbourRect.left !== rect.left || neighbourRect.right !== rect.right) {
    return false;
  }

  const rows = table.content!;
  const cell = rows[ref.rowIndex].content![ref.cellIndex];
  const neighbour = rows[neighbourRef.rowIndex].content![neighbourRef.cellIndex];

  setSpan(
    cell,
    "rowspan",
    span(cell, "rowspan") + span(neighbour, "rowspan"),
  );
  cell.content = [...(cell.content ?? []), ...(neighbour.content ?? [])];
  rows[neighbourRef.rowIndex].content!.splice(neighbourRef.cellIndex, 1);
  return true;
}

/**
 * Split a merged cell back into 1×1 cells. The original cell keeps its
 * content; the freed visual cells become empty cells.
 */
export function splitCell(table: DocumentNode, row: number, col: number): boolean {
  const map = buildTableMap(table);
  const ref = cellAt(map, row, col);
  if (!ref) return false;
  const rect = rectOf(map, ref);
  if (!rect) return false;

  const colspan = rect.right - rect.left;
  const rowspan = rect.bottom - rect.top;
  if (colspan <= 1 && rowspan <= 1) return false; // nothing to split

  const rows = table.content!;
  const cell = rows[ref.rowIndex].content![ref.cellIndex];
  const header = Boolean(cell.attrs?.header);
  setSpan(cell, "colspan", 1);
  setSpan(cell, "rowspan", 1);

  // Fill the freed visual cells, working row by row. For the cell's
  // own row we add (colspan-1) cells right after it; for the rows it
  // used to span we insert a run of `colspan` cells.
  for (let r = rect.top; r < rect.bottom; r++) {
    const targetRow = rows[r];
    if (!targetRow.content) targetRow.content = [];
    if (r === rect.top) {
      const insertAt = ref.cellIndex + 1;
      for (let i = 0; i < colspan - 1; i++) {
        targetRow.content.splice(insertAt, 0, emptyCell(header));
      }
    } else {
      // Find the logical insertion index that matches visual column
      // rect.left in this row.
      const rowMap = buildTableMap(table);
      let insertAt = targetRow.content.length;
      for (let ci = 0; ci < targetRow.content.length; ci++) {
        const rr = rectOf(rowMap, { rowIndex: r, cellIndex: ci });
        if (rr && rr.left >= rect.left) {
          insertAt = ci;
          break;
        }
      }
      for (let i = 0; i < colspan; i++) {
        targetRow.content.splice(insertAt, 0, emptyCell(header));
      }
    }
  }
  return true;
}

/**
 * Merge every cell inside a visual rectangle into one.
 *
 * The rectangle must be "clean": every cell it touches must lie fully
 * inside it — a cell sticking out (a span crossing the boundary)
 * makes the merge impossible, and the function returns false. The
 * top-left cell becomes the merged cell, taking a colspan / rowspan
 * that covers the whole rectangle; the others' content is appended to
 * it in reading order and they're removed.
 */
export function mergeCellRange(
  table: DocumentNode,
  rect: { top: number; left: number; bottom: number; right: number },
): boolean {
  const map = buildTableMap(table);
  if (
    rect.top < 0 ||
    rect.left < 0 ||
    rect.bottom > map.height ||
    rect.right > map.width ||
    rect.right - rect.left < 1 ||
    rect.bottom - rect.top < 1
  ) {
    return false;
  }

  // Collect the distinct cells inside the rectangle, checking each
  // one is fully contained.
  const refs: CellRef[] = [];
  const seen = new Set<string>();
  for (let r = rect.top; r < rect.bottom; r++) {
    for (let c = rect.left; c < rect.right; c++) {
      const ref = cellAt(map, r, c);
      if (!ref) return false; // hole in the grid
      const key = refKey(ref);
      if (seen.has(key)) continue;
      seen.add(key);
      const cr = rectOf(map, ref);
      if (
        !cr ||
        cr.top < rect.top ||
        cr.left < rect.left ||
        cr.bottom > rect.bottom ||
        cr.right > rect.right
      ) {
        return false; // ragged — a cell crosses the boundary
      }
      refs.push(ref);
    }
  }
  if (refs.length < 2) return false; // nothing to merge

  const rows = table.content!;
  const anchorRef = cellAt(map, rect.top, rect.left)!;
  const anchorKey = refKey(anchorRef);
  const anchorCell = rows[anchorRef.rowIndex].content![anchorRef.cellIndex];

  // Append every other cell's content in reading order.
  const others = refs
    .filter((r) => refKey(r) !== anchorKey)
    .sort((a, b) => a.rowIndex - b.rowIndex || a.cellIndex - b.cellIndex);

  let content = [...(anchorCell.content ?? [])];
  for (const ref of others) {
    const cell = rows[ref.rowIndex].content![ref.cellIndex];
    content = [...content, ...(cell.content ?? [])];
  }
  anchorCell.content = content;
  setSpan(anchorCell, "colspan", rect.right - rect.left);
  setSpan(anchorCell, "rowspan", rect.bottom - rect.top);

  // Remove the others — per row, highest cell index first so the
  // lower indices stay valid.
  const byRow = new Map<number, number[]>();
  for (const ref of others) {
    const list = byRow.get(ref.rowIndex) ?? [];
    list.push(ref.cellIndex);
    byRow.set(ref.rowIndex, list);
  }
  for (const [rowIdx, cellIdxs] of byRow) {
    cellIdxs
      .sort((a, b) => b - a)
      .forEach((ci) => rows[rowIdx].content!.splice(ci, 1));
  }
  return true;
}

// ============================================================================
// Internal helpers
// ============================================================================

function refEq(a: CellRef, b: CellRef): boolean {
  return a.rowIndex === b.rowIndex && a.cellIndex === b.cellIndex;
}

function refKey(r: CellRef): string {
  return `${r.rowIndex}:${r.cellIndex}`;
}

// ============================================================================
// Column width
// ============================================================================
/**
 * Set a pixel `colwidth` on every single-column cell that starts in
 * the given visual column. With `table-layout: fixed` (the default
 * theme), that fixes the column's rendered width.
 *
 * Cells spanning multiple columns are skipped — their width is the
 * sum of the columns they cover, so a single value wouldn't be
 * meaningful.
 */
export function setColumnWidth(
  table: DocumentNode,
  visualCol: number,
  width: number,
): void {
  const map = buildTableMap(table);
  if (visualCol < 0 || visualCol >= map.width) return;
  const rows = table.content ?? [];
  const w = Math.max(24, Math.round(width));
  const done = new Set<string>();

  for (let r = 0; r < map.height; r++) {
    const ref = cellAt(map, r, visualCol);
    if (!ref) continue;
    const key = refKey(ref);
    if (done.has(key)) continue;
    done.add(key);
    const rect = rectOf(map, ref);
    if (rect && rect.left === visualCol && rect.right - rect.left === 1) {
      const cell = rows[ref.rowIndex].content![ref.cellIndex];
      cell.attrs = { ...(cell.attrs ?? {}), colwidth: w };
    }
  }
}
