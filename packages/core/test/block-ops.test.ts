/**
 * Tests for block-ops: wrap, unwrap, and toggle of block wrappers
 * (blockquote, lists). These run headlessly — no DOM involved.
 */

import { describe, it, expect } from "vitest";
import {
  wrapBlocks,
  unwrapBlock,
  toggleWrap,
  selectionInsideWrapper,
} from "../src/block-ops.js";
import type { DocumentJSON, EditorSelection } from "../src/index.js";

const docOf = (...blocks: { type: string; text?: string }[]): DocumentJSON => ({
  type: "doc",
  content: blocks.map((b) => ({
    type: b.type,
    content: b.text ? [{ type: "text", text: b.text }] : [],
  })),
});

const sel = (blockIdx: number): EditorSelection => ({
  anchor: { path: [blockIdx], offset: 0 },
  head: { path: [blockIdx], offset: 0 },
});

const rangeSel = (
  startIdx: number,
  endIdx: number,
): EditorSelection => ({
  anchor: { path: [startIdx], offset: 0 },
  head: { path: [endIdx], offset: 0 },
});

describe("wrapBlocks", () => {
  it("wraps a single block in a blockquote", () => {
    const doc = docOf({ type: "paragraph", text: "Hi" });
    const next = wrapBlocks(doc, sel(0), "blockquote");
    expect(next).not.toBeNull();
    expect(next!.content[0].type).toBe("blockquote");
    expect(next!.content[0].content?.[0].type).toBe("paragraph");
  });

  it("wraps multiple selected blocks into one wrapper", () => {
    const doc = docOf(
      { type: "paragraph", text: "A" },
      { type: "paragraph", text: "B" },
      { type: "paragraph", text: "C" },
    );
    const next = wrapBlocks(doc, rangeSel(0, 2), "blockquote");
    expect(next!.content).toHaveLength(1);
    expect(next!.content[0].content).toHaveLength(3);
  });

  it("wraps blocks in list_item then bullet_list when itemType is given", () => {
    const doc = docOf(
      { type: "paragraph", text: "one" },
      { type: "paragraph", text: "two" },
    );
    const next = wrapBlocks(doc, rangeSel(0, 1), "bullet_list", "list_item");
    expect(next!.content).toHaveLength(1);
    expect(next!.content[0].type).toBe("bullet_list");
    expect(next!.content[0].content?.[0].type).toBe("list_item");
    expect(next!.content[0].content?.[0].content?.[0].type).toBe("paragraph");
  });
  it("wraps a selection inside blockquote without wrapping the quote", () => {
    const doc: DocumentJSON = {
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "one" }] },
          ],
        },
      ],
    };
    const next = wrapBlocks(
      doc,
      {
        anchor: { path: [0, 0], offset: 0 },
        head: { path: [0, 0], offset: 0 },
      },
      "bullet_list",
      "list_item",
    );

    expect(next!.content[0].type).toBe("blockquote");
    expect(next!.content[0].content![0].type).toBe("bullet_list");
    expect(next!.content[0].content![0].content![0].type).toBe("list_item");
    expect(next!.content[0].content![0].content![0].content![0].type).toBe(
      "paragraph",
    );
  });

});

describe("unwrapBlock", () => {
  it("unwraps a blockquote, hoisting its children", () => {
    const doc: DocumentJSON = {
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "x" }] },
          ],
        },
      ],
    };
    const next = unwrapBlock(doc, 0);
    expect(next!.content[0].type).toBe("paragraph");
  });

  it("unwraps a list two levels deep when unwrapItemToo is true", () => {
    const doc: DocumentJSON = {
      type: "doc",
      content: [
        {
          type: "bullet_list",
          content: [
            {
              type: "list_item",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "x" }],
                },
              ],
            },
          ],
        },
      ],
    };
    const next = unwrapBlock(doc, 0, true);
    expect(next!.content[0].type).toBe("paragraph");
  });
});

describe("toggleWrap", () => {
  it("wraps then unwraps the same selection cleanly", () => {
    const doc = docOf({ type: "paragraph", text: "Hi" });
    const wrapped = toggleWrap(doc, sel(0), "blockquote");
    expect(wrapped!.content[0].type).toBe("blockquote");

    const unwrapped = toggleWrap(wrapped!, sel(0), "blockquote");
    expect(unwrapped!.content[0].type).toBe("paragraph");
  });

  it("unwraps the nearest nested list instead of the outer blockquote", () => {
    const doc: DocumentJSON = {
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [
            {
              type: "bullet_list",
              content: [
                {
                  type: "list_item",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "quoted list" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const next = toggleWrap(
      doc,
      {
        anchor: { path: [0, 0, 0, 0], offset: 0 },
        head: { path: [0, 0, 0, 0], offset: 0 },
      },
      "bullet_list",
      "list_item",
    );

    expect(next!.content[0].type).toBe("blockquote");
    expect(next!.content[0].content![0].type).toBe("paragraph");
  });

  it("unwraps blockquote when the selection is inside it", () => {
    const doc: DocumentJSON = {
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "quote" }] },
          ],
        },
      ],
    };
    const next = toggleWrap(
      doc,
      {
        anchor: { path: [0, 0], offset: 0 },
        head: { path: [0, 0], offset: 0 },
      },
      "blockquote",
    );

    expect(next!.content[0].type).toBe("paragraph");
  });

});

describe("selectionInsideWrapper", () => {
  it("returns true when the top-level block matches", () => {
    const doc: DocumentJSON = {
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [{ type: "paragraph", content: [] }],
        },
      ],
    };
    expect(selectionInsideWrapper(doc, sel(0), "blockquote")).toBe(true);
    expect(selectionInsideWrapper(doc, sel(0), "bullet_list")).toBe(false);
  });

  it("returns true for a deeply nested list inside blockquote", () => {
    const doc: DocumentJSON = {
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [
            {
              type: "bullet_list",
              content: [
                {
                  type: "list_item",
                  content: [{ type: "paragraph", content: [] }],
                },
              ],
            },
          ],
        },
      ],
    };
    const selection: EditorSelection = {
      anchor: { path: [0, 0, 0, 0], offset: 0 },
      head: { path: [0, 0, 0, 0], offset: 0 },
    };

    expect(selectionInsideWrapper(doc, selection, "blockquote")).toBe(true);
    expect(selectionInsideWrapper(doc, selection, "bullet_list")).toBe(true);
  });

});
