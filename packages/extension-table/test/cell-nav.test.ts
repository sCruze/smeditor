/**
 * Tests for table cell-navigation — nextCellLeaf / prevCellLeaf.
 *
 * These helpers are not exported, so the test exercises them through
 * the deep paths they produce: given a caret path inside a cell, the
 * next/previous cell's leaf path.
 *
 * The helpers are re-exported from a test entry to keep them pure and
 * checkable.
 */

import { describe, it, expect } from "vitest";
import { __test } from "../src/index.js";
import type { DocumentJSON } from "@smeditor/core";

const { nextCellLeaf, prevCellLeaf } = __test;

/** A document with a 2x2 table at index 1. */
function tableDoc(): DocumentJSON {
  const cell = (t: string) => ({
    type: "table_cell",
    content: [{ type: "paragraph", content: [{ type: "text", text: t }] }],
  });
  const row = (a: string, b: string) => ({
    type: "table_row",
    content: [cell(a), cell(b)],
  });
  return {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "intro" }] },
      { type: "table", content: [row("A", "B"), row("C", "D")] },
    ],
  };
}

describe("nextCellLeaf", () => {
  it("moves to the next cell in the row", () => {
    // caret in cell A: [1,0,0,0]
    expect(nextCellLeaf(tableDoc(), [1, 0, 0, 0])).toEqual([1, 0, 1, 0]);
  });
  it("wraps to the first cell of the next row", () => {
    // caret in cell B (last of row 0)
    expect(nextCellLeaf(tableDoc(), [1, 0, 1, 0])).toEqual([1, 1, 0, 0]);
  });
  it("returns null at the last cell", () => {
    expect(nextCellLeaf(tableDoc(), [1, 1, 1, 0])).toBeNull();
  });
  it("returns null outside a table", () => {
    expect(nextCellLeaf(tableDoc(), [0])).toBeNull();
  });
});

describe("prevCellLeaf", () => {
  it("moves to the previous cell in the row", () => {
    expect(prevCellLeaf(tableDoc(), [1, 0, 1, 0])).toEqual([1, 0, 0, 0]);
  });
  it("wraps to the last cell of the previous row", () => {
    expect(prevCellLeaf(tableDoc(), [1, 1, 0, 0])).toEqual([1, 0, 1, 0]);
  });
  it("returns null at the first cell", () => {
    expect(prevCellLeaf(tableDoc(), [1, 0, 0, 0])).toBeNull();
  });
});
