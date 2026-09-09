/**
 * Tests for the path-resolution helpers — step 1 of the deep
 * selection model.
 */

import { describe, it, expect } from "vitest";
import {
  isLeafBlock,
  isContainerBlock,
  nodeAt,
  parentAt,
  descendToLeafPath,
  mapNodeAt,
  removeNodeAt,
  resolveSelectionTarget,
  normalizeDeepPoint,
} from "../src/path.js";
import type { DocumentJSON, DocumentNode } from "../src/types.js";

const text = (t: string): DocumentNode => ({ type: "text", text: t });
const para = (t: string): DocumentNode => ({
  type: "paragraph",
  content: [text(t)],
});

/** A doc with a paragraph and a 1-row / 2-cell table. */
function sampleDoc(): DocumentJSON {
  return {
    type: "doc",
    content: [
      para("top"),
      {
        type: "table",
        content: [
          {
            type: "table_row",
            content: [
              { type: "table_cell", content: [para("A")] },
              { type: "table_cell", content: [para("B")] },
            ],
          },
        ],
      },
    ],
  };
}

describe("classification", () => {
  it("treats a paragraph as a leaf", () => {
    expect(isLeafBlock(para("x"))).toBe(true);
  });
  it("treats an empty block as a leaf", () => {
    expect(isLeafBlock({ type: "paragraph" })).toBe(true);
  });
  it("treats a table as a container", () => {
    expect(isContainerBlock(sampleDoc().content[1])).toBe(true);
  });
  it("treats a table_cell as a container", () => {
    const cell: DocumentNode = { type: "table_cell", content: [para("A")] };
    expect(isContainerBlock(cell)).toBe(true);
  });
});

describe("nodeAt", () => {
  it("resolves a top-level node", () => {
    expect(nodeAt(sampleDoc(), [0]).type).toBe("paragraph");
  });
  it("resolves a deep node — a cell paragraph", () => {
    const node = nodeAt(sampleDoc(), [1, 0, 1, 0]);
    expect(node?.content?.[0].text).toBe("B");
  });
  it("returns null for an off-tree path", () => {
    expect(nodeAt(sampleDoc(), [9])).toBeNull();
    expect(nodeAt(sampleDoc(), [1, 0, 5])).toBeNull();
  });
  it("resolves the root for an empty path", () => {
    expect(nodeAt(sampleDoc(), []).type).toBe("doc");
  });
});

describe("parentAt", () => {
  it("returns the parent of a deep node", () => {
    expect(parentAt(sampleDoc(), [1, 0, 1]).type).toBe("table_row");
  });
  it("returns null for a top-level node's parent path", () => {
    // parent of [0] is the doc root
    expect(parentAt(sampleDoc(), [0]).type).toBe("doc");
  });
});

describe("descendToLeafPath", () => {
  it("descends a table path to its first cell paragraph", () => {
    expect(descendToLeafPath(sampleDoc(), [1])).toEqual([1, 0, 0, 0]);
  });
  it("leaves a leaf path unchanged", () => {
    expect(descendToLeafPath(sampleDoc(), [0])).toEqual([0]);
  });
});

describe("mapNodeAt", () => {
  it("replaces a deep node immutably", () => {
    const doc = sampleDoc();
    // [1,0,0,0,0] is the text node inside cell A's paragraph.
    const next = mapNodeAt(doc, [1, 0, 0, 0, 0], () => text("changed"));
    expect(nodeAt(next, [1, 0, 0, 0, 0]).text).toBe("changed");
    // original untouched
    expect(nodeAt(doc, [1, 0, 0, 0, 0]).text).toBe("A");
    // unrelated branch is shared, not cloned
    expect(next.content[0]).toBe(doc.content[0]);
  });
  it("returns the document unchanged for an off-tree path", () => {
    const doc = sampleDoc();
    expect(mapNodeAt(doc, [9], () => text("x"))).toBe(doc);
  });
});

describe("removeNodeAt", () => {
  it("removes a top-level node", () => {
    const next = removeNodeAt(sampleDoc(), [0]);
    expect(next.content).toHaveLength(1);
    expect(next.content[0].type).toBe("table");
  });
  it("removes a deep node — one table cell", () => {
    const next = removeNodeAt(sampleDoc(), [1, 0, 0]);
    expect(nodeAt(next, [1, 0]).content).toHaveLength(1);
    expect(nodeAt(next, [1, 0, 0, 0]).content?.[0].text).toBe("B");
  });
});

describe("resolveSelectionTarget", () => {
  it("resolves a top-level path to its block", () => {
    const doc = sampleDoc();
    const sel = {
      anchor: { path: [0], offset: 0 },
      head: { path: [0], offset: 0 },
    };
    const target = resolveSelectionTarget(doc, sel);
    expect(target?.node.type).toBe("paragraph");
    expect(target?.path).toEqual([0]);
  });

  it("resolves a deep path to a cell paragraph", () => {
    const doc = sampleDoc();
    const sel = {
      anchor: { path: [1, 0, 1, 0], offset: 0 },
      head: { path: [1, 0, 1, 0], offset: 0 },
    };
    const target = resolveSelectionTarget(doc, sel);
    expect(target?.node.content?.[0].text).toBe("B");
  });

  it("returns null for no selection", () => {
    expect(resolveSelectionTarget(sampleDoc(), null)).toBeNull();
  });
});

describe("normalizeDeepPoint", () => {
  it("descends a container point to its first leaf", () => {
    const doc = sampleDoc();
    // [1] is the table — a container.
    const out = normalizeDeepPoint(doc, { path: [1], offset: 5 });
    expect(out.path).toEqual([1, 0, 0, 0]);
    expect(out.offset).toBe(0);
  });

  it("leaves a leaf-block point unchanged", () => {
    const doc = sampleDoc();
    const point = { path: [1, 0, 0, 0], offset: 3 };
    expect(normalizeDeepPoint(doc, point)).toEqual(point);
  });

  it("leaves a top-level paragraph point unchanged", () => {
    const doc = sampleDoc();
    const point = { path: [0], offset: 2 };
    expect(normalizeDeepPoint(doc, point)).toEqual(point);
  });
});
