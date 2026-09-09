/**
 * Tests for the table grid model — buildTableMap and the pure
 * structural transforms (add/remove column & row, merge, split).
 *
 * These run headlessly: plain DocumentNode objects, no DOM, no editor.
 */

import { describe, it, expect } from "vitest";
import {
  buildTableMap,
  rectOf,
  cellAt,
  addColumnAt,
  removeColumnAt,
  addRowAt,
  removeRowAt,
  mergeRight,
  splitCell,
  mergeCellRange,
} from "../src/table-map.js";
import type { DocumentNode } from "@smeditor/core";

/** Build a plain R×C table of single-span cells. */
function grid(rows: number, cols: number): DocumentNode {
  return {
    type: "table",
    content: Array.from({ length: rows }, () => ({
      type: "table_row",
      content: Array.from({ length: cols }, () => ({
        type: "table_cell",
        content: [{ type: "paragraph" }],
      })),
    })),
  };
}

/** Count logical cells in a row. */
const rowLen = (t: DocumentNode, r: number) =>
  t.content?.[r].content?.length ?? 0;

describe("buildTableMap", () => {
  it("maps a plain grid 1:1", () => {
    const map = buildTableMap(grid(2, 3));
    expect(map.width).toBe(3);
    expect(map.height).toBe(2);
    expect(cellAt(map, 0, 0)).toEqual({ rowIndex: 0, cellIndex: 0 });
    expect(cellAt(map, 1, 2)).toEqual({ rowIndex: 1, cellIndex: 2 });
  });

  it("expands a colspan cell across visual columns", () => {
    const t = grid(1, 2);
    t.content![0].content![0].attrs = { colspan: 2 };
    // Row is now [colspan-2 cell][normal cell] → 3 visual columns.
    const map = buildTableMap(t);
    expect(map.width).toBe(3);
    expect(cellAt(map, 0, 0)).toEqual({ rowIndex: 0, cellIndex: 0 });
    expect(cellAt(map, 0, 1)).toEqual({ rowIndex: 0, cellIndex: 0 });
    expect(cellAt(map, 0, 2)).toEqual({ rowIndex: 0, cellIndex: 1 });
  });

  it("expands a rowspan cell down visual rows", () => {
    const t = grid(2, 2);
    t.content![0].content![0].attrs = { rowspan: 2 };
    const map = buildTableMap(t);
    // The rowspan cell occupies (0,0) and (1,0).
    expect(cellAt(map, 0, 0)).toEqual({ rowIndex: 0, cellIndex: 0 });
    expect(cellAt(map, 1, 0)).toEqual({ rowIndex: 0, cellIndex: 0 });
  });

  it("reports a cell's visual rectangle", () => {
    const t = grid(2, 2);
    t.content![0].content![0].attrs = { colspan: 2 };
    const map = buildTableMap(t);
    const rect = rectOf(map, { rowIndex: 0, cellIndex: 0 });
    expect(rect).toEqual({ top: 0, left: 0, bottom: 1, right: 2 });
  });
});

describe("addColumnAt", () => {
  it("adds a plain column", () => {
    const t = grid(2, 2);
    addColumnAt(t, 1);
    expect(rowLen(t, 0)).toBe(3);
    expect(rowLen(t, 1)).toBe(3);
  });

  it("widens a spanning cell instead of splitting it", () => {
    const t = grid(1, 2);
    t.content![0].content![0].attrs = { colspan: 2 };
    // Insert inside the span (visual column 1).
    addColumnAt(t, 1);
    // The spanning cell should now be colspan 3, still 2 logical cells.
    expect(rowLen(t, 0)).toBe(2);
    expect(t.content![0].content![0].attrs?.colspan).toBe(3);
  });
});

describe("removeColumnAt", () => {
  it("removes a plain column", () => {
    const t = grid(2, 3);
    removeColumnAt(t, 1);
    expect(rowLen(t, 0)).toBe(2);
    expect(rowLen(t, 1)).toBe(2);
  });

  it("shrinks a spanning cell rather than deleting it", () => {
    const t = grid(1, 2);
    t.content![0].content![0].attrs = { colspan: 2 };
    removeColumnAt(t, 0);
    // colspan 2 → 1; the cell survives.
    expect(rowLen(t, 0)).toBe(2);
    expect(t.content![0].content![0].attrs?.colspan ?? 1).toBe(1);
  });
});

describe("addRowAt / removeRowAt", () => {
  it("adds and removes rows", () => {
    const t = grid(2, 2);
    addRowAt(t, 1);
    expect(t.content).toHaveLength(3);
    removeRowAt(t, 0);
    expect(t.content).toHaveLength(2);
  });

  it("relocates a rowspan cell to its visual column, not column 0", () => {
    // Row0 = [A@col0, B@col1, X@col2 (rowspan 2)], Row1 = [C@col0, D@col1].
    const cell = (text: string, attrs?: Record<string, unknown>) => ({
      type: "table_cell",
      content: [{ type: "paragraph", content: [{ type: "text", text }] }],
      ...(attrs ? { attrs } : {}),
    });
    const t: DocumentNode = {
      type: "table",
      content: [
        {
          type: "table_row",
          content: [cell("A"), cell("B"), cell("X", { rowspan: 2 })],
        },
        { type: "table_row", content: [cell("C"), cell("D")] },
      ],
    };

    removeRowAt(t, 0);

    expect(t.content).toHaveLength(1);
    const texts = t.content![0].content!.map(
      (c) => c.content?.[0]?.content?.[0]?.text,
    );
    // X must stay at visual column 2, not jump to the front.
    expect(texts).toEqual(["C", "D", "X"]);
    // The relocated X cell's rowspan shrank to 1 (dropped).
    expect(t.content![0].content![2].attrs?.rowspan ?? 1).toBe(1);
  });
});

describe("mergeRight", () => {
  it("merges two adjacent cells into one colspan-2 cell", () => {
    const t = grid(1, 3);
    const ok = mergeRight(t, 0, 0);
    expect(ok).toBe(true);
    expect(rowLen(t, 0)).toBe(2);
    expect(t.content![0].content![0].attrs?.colspan).toBe(2);
  });

  it("refuses to merge past the table edge", () => {
    const t = grid(1, 2);
    expect(mergeRight(t, 0, 1)).toBe(false);
  });
});

describe("splitCell", () => {
  it("splits a merged cell back into single cells", () => {
    const t = grid(1, 3);
    mergeRight(t, 0, 0); // now [colspan2][normal]
    expect(rowLen(t, 0)).toBe(2);
    const ok = splitCell(t, 0, 0);
    expect(ok).toBe(true);
    expect(rowLen(t, 0)).toBe(3);
    expect(t.content![0].content![0].attrs?.colspan ?? 1).toBe(1);
  });

  it("returns false for an un-merged cell", () => {
    const t = grid(2, 2);
    expect(splitCell(t, 0, 0)).toBe(false);
  });
});

describe("mergeCellRange", () => {
  it("merges a 2x2 rectangle into one cell", () => {
    const t = grid(3, 3);
    const ok = mergeCellRange(t, { top: 0, left: 0, bottom: 2, right: 2 });
    expect(ok).toBe(true);
    // Row 0 had 3 cells → the 2-wide merge leaves 2 logical cells.
    expect(rowLen(t, 0)).toBe(2);
    expect(rowLen(t, 1)).toBe(1);
    const anchor = t.content![0].content![0];
    expect(anchor.attrs?.colspan).toBe(2);
    expect(anchor.attrs?.rowspan).toBe(2);
  });

  it("refuses a single-cell range", () => {
    const t = grid(2, 2);
    expect(mergeCellRange(t, { top: 0, left: 0, bottom: 1, right: 1 })).toBe(
      false,
    );
  });

  it("refuses a ragged rectangle", () => {
    const t = grid(2, 3);
    // Pre-merge the top-left two cells into a colspan-2.
    mergeRight(t, 0, 0);
    // A 2x2 rect starting at column 1 would cut through that span.
    expect(mergeCellRange(t, { top: 0, left: 1, bottom: 2, right: 3 })).toBe(
      false,
    );
  });
});
