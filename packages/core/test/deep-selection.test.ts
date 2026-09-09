/**
 * Deep-selection tests — proving the mark and block helpers operate
 * correctly when the selection path reaches inside a container
 * (a table cell), not just a top-level block.
 */

import { describe, it, expect } from "vitest";
import {
  toggleMarkInDoc,
  selectionHasMark,
  setBlockType,
  leafBlocksInSelection,
} from "../src/doc-utils.js";
import type { DocumentJSON, EditorSelection } from "../src/types.js";

/** Doc: a top-level paragraph and a 1-row / 2-cell table. */
function sampleDoc(): DocumentJSON {
  return {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "top" }] },
      {
        type: "table",
        content: [
          {
            type: "table_row",
            content: [
              {
                type: "table_cell",
                content: [
                  { type: "paragraph", content: [{ type: "text", text: "cell A" }] },
                ],
              },
              {
                type: "table_cell",
                content: [
                  { type: "paragraph", content: [{ type: "text", text: "cell B" }] },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

/** A collapsed-ish selection covering one leaf block at `path`. */
const sel = (path: number[], from = 0, to = 99): EditorSelection => ({
  anchor: { path, offset: from },
  head: { path, offset: to },
});

describe("deep selection — marks", () => {
  it("toggles bold inside a table cell paragraph", () => {
    // [1,0,0,0] is cell A's paragraph.
    const next = toggleMarkInDoc(sampleDoc(), sel([1, 0, 0, 0]), "bold");
    expect(next).not.toBeNull();
    const cellAText = next!.content[1].content![0].content![0]
      .content![0].content![0];
    expect(cellAText.marks?.[0].type).toBe("bold");
    // cell B untouched
    const cellBText = next!.content[1].content![0].content![1]
      .content![0].content![0];
    expect(cellBText.marks).toBeUndefined();
  });

  it("reports mark presence for a deep selection", () => {
    const bolded = toggleMarkInDoc(sampleDoc(), sel([1, 0, 0, 0]), "bold")!;
    expect(selectionHasMark(bolded, sel([1, 0, 0, 0]), "bold")).toBe(true);
    expect(selectionHasMark(bolded, sel([1, 0, 1, 0]), "bold")).toBe(false);
  });

  it("still toggles a top-level paragraph", () => {
    const next = toggleMarkInDoc(sampleDoc(), sel([0]), "italic");
    expect(next!.content[0].content![0].marks?.[0].type).toBe("italic");
  });
});

describe("deep selection — leafBlocksInSelection", () => {
  it("resolves a deep selection to one cell paragraph", () => {
    const leaves = leafBlocksInSelection(sampleDoc(), sel([1, 0, 0, 0]));
    expect(leaves).toHaveLength(1);
    expect(leaves[0].path).toEqual([1, 0, 0, 0]);
  });

  it("resolves a top-level range to its blocks", () => {
    const doc: DocumentJSON = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "a" }] },
        { type: "paragraph", content: [{ type: "text", text: "b" }] },
        { type: "paragraph", content: [{ type: "text", text: "c" }] },
      ],
    };
    const leaves = leafBlocksInSelection(doc, {
      anchor: { path: [0], offset: 0 },
      head: { path: [2], offset: 0 },
    });
    expect(leaves.map((l) => l.path)).toEqual([[0], [1], [2]]);
  });
});

describe("deep selection — setBlockType", () => {
  it("retypes a cell paragraph to a heading", () => {
    const next = setBlockType(sampleDoc(), sel([1, 0, 0, 0]), "heading", {
      level: 2,
    });
    const cellAPara = next!.content[1].content![0].content![0].content![0];
    expect(cellAPara.type).toBe("heading");
    expect(cellAPara.attrs?.level).toBe(2);
    // cell B's paragraph untouched
    const cellBPara = next!.content[1].content![0].content![1].content![0];
    expect(cellBPara.type).toBe("paragraph");
  });

  it("still retypes a top-level block", () => {
    const next = setBlockType(sampleDoc(), sel([0]), "heading", { level: 1 });
    expect(next!.content[0].type).toBe("heading");
  });
});

// Block-attribute commands (text-align, indent) resolve their target
// blocks through leafBlocksInSelection too — exercised here at the
// helper level, the way those commands now call it.
describe("deep selection — block-attribute range", () => {
  it("collects only the addressed cell paragraph", () => {
    const leaves = leafBlocksInSelection(sampleDoc(), sel([1, 0, 1, 0]));
    expect(leaves).toHaveLength(1);
    expect(leaves[0].node.type).toBe("paragraph");
    expect(leaves[0].path).toEqual([1, 0, 1, 0]);
  });

  it("a deep attr write touches only the resolved leaf", () => {
    const doc = sampleDoc();
    // Simulate what setTextAlign now does: write attrs onto each leaf.
    const leaves = leafBlocksInSelection(doc, sel([1, 0, 0, 0]));
    for (const { node } of leaves) {
      node.attrs = { ...(node.attrs ?? {}), textAlign: "center" };
    }
    const cellA = doc.content[1].content![0].content![0].content![0];
    const cellB = doc.content[1].content![0].content![1].content![0];
    expect(cellA.attrs?.textAlign).toBe("center");
    expect(cellB.attrs).toBeUndefined();
  });
});

