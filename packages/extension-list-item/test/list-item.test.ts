/**
 * Tests for caret-aware list behaviour — splitListItem / liftListItem.
 * Pure functions: document + selection in, new document out.
 */

import { describe, it, expect } from "vitest";
import { splitListItem, liftListItem, sinkListItem } from "../src/index.js";
import type { DocumentJSON, EditorSelection } from "@smeditor/core";

const text = (t: string) => ({ type: "text", text: t });

/** doc: a paragraph, then a 2-item bullet list. */
function listDoc(): DocumentJSON {
  return {
    type: "doc",
    content: [
      { type: "paragraph", content: [text("intro")] },
      {
        type: "bullet_list",
        content: [
          {
            type: "list_item",
            content: [{ type: "paragraph", content: [text("one")] }],
          },
          {
            type: "list_item",
            content: [{ type: "paragraph", content: [text("two")] }],
          },
        ],
      },
    ],
  };
}

/** A list with a single empty item. */
function emptyItemDoc(): DocumentJSON {
  return {
    type: "doc",
    content: [
      { type: "paragraph", content: [text("intro")] },
      {
        type: "bullet_list",
        content: [
          { type: "list_item", content: [{ type: "paragraph" }] },
        ],
      },
    ],
  };
}

/** A blockquote containing a single bullet list item. */
function quotedListDoc(empty = false): DocumentJSON {
  return {
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
                  empty
                    ? { type: "paragraph" }
                    : { type: "paragraph", content: [text("quote")] },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

const at = (path: number[], offset: number): EditorSelection => ({
  anchor: { path, offset },
  head: { path, offset },
});

describe("splitListItem", () => {
  it("splits an item at the caret", () => {
    // [1,0,0] is the first item's paragraph; caret after "on".
    const r = splitListItem(listDoc(), at([1, 0, 0], 2));
    expect(r).not.toBeNull();
    const list = r!.doc.content[1];
    expect(list.content).toHaveLength(3);
    expect(list.content![0].content![0].content![0].text).toBe("on");
    expect(list.content![1].content![0].content![0].text).toBe("e");
    expect(list.content![2].content![0].content![0].text).toBe("two");
    expect(r!.caret).toEqual([1, 1, 0]);
  });

  it("splits at the end into an empty new item", () => {
    const r = splitListItem(listDoc(), at([1, 0, 0], 3));
    const list = r!.doc.content[1];
    expect(list.content).toHaveLength(3);
    expect(list.content![1].content![0].content ?? []).toHaveLength(0);
  });

  it("returns null when the caret is not in a list", () => {
    expect(splitListItem(listDoc(), at([0], 1))).toBeNull();
  });

  it("a new task item starts unchecked", () => {
    const doc: DocumentJSON = {
      type: "doc",
      content: [
        {
          type: "task_list",
          content: [
            {
              type: "task_item",
              attrs: { checked: true },
              content: [{ type: "paragraph", content: [text("done")] }],
            },
          ],
        },
      ],
    };
    const r = splitListItem(doc, at([0, 0, 0], 2));
    expect(r!.doc.content[0].content![1].attrs?.checked).toBe(false);
  });

  it("preserves sibling blocks when splitting in a later paragraph", () => {
    // A list item with two paragraphs; caret in the SECOND one, after "sec".
    const doc: DocumentJSON = {
      type: "doc",
      content: [
        {
          type: "bullet_list",
          content: [
            {
              type: "list_item",
              content: [
                { type: "paragraph", content: [text("first")] },
                { type: "paragraph", content: [text("second")] },
              ],
            },
          ],
        },
      ],
    };
    const r = splitListItem(doc, at([0, 0, 1], 3));
    expect(r).not.toBeNull();
    const list = r!.doc.content[0];
    expect(list.content).toHaveLength(2);
    // Old item keeps "first" plus the before-caret part of "second".
    const item0 = list.content![0];
    expect(item0.content).toHaveLength(2);
    expect(item0.content![0].content![0].text).toBe("first");
    expect(item0.content![1].content![0].text).toBe("sec");
    // New item carries the after-caret part of "second".
    const item1 = list.content![1];
    expect(item1.content).toHaveLength(1);
    expect(item1.content![0].content![0].text).toBe("ond");
    expect(r!.caret).toEqual([0, 1, 0]);
  });

  it("keeps a nested sub-list with the new item when splitting the parent paragraph", () => {
    // Item: [paragraph('parent'), bullet_list(child)]; caret in the paragraph.
    const doc: DocumentJSON = {
      type: "doc",
      content: [
        {
          type: "bullet_list",
          content: [
            {
              type: "list_item",
              content: [
                { type: "paragraph", content: [text("parent")] },
                {
                  type: "bullet_list",
                  content: [
                    {
                      type: "list_item",
                      content: [
                        { type: "paragraph", content: [text("child")] },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const r = splitListItem(doc, at([0, 0, 0], 6));
    expect(r).not.toBeNull();
    const list = r!.doc.content[0];
    expect(list.content).toHaveLength(2);
    // Old item keeps just the (full) parent paragraph.
    const item0 = list.content![0];
    expect(item0.content).toHaveLength(1);
    expect(item0.content![0].content![0].text).toBe("parent");
    // New item gets the empty after-paragraph followed by the nested list.
    const item1 = list.content![1];
    expect(item1.content).toHaveLength(2);
    expect(item1.content![0].type).toBe("paragraph");
    expect(item1.content![0].content ?? []).toHaveLength(0);
    expect(item1.content![1].type).toBe("bullet_list");
    expect(item1.content![1].content![0].content![0].content![0].text).toBe(
      "child",
    );
    expect(r!.caret).toEqual([0, 1, 0]);
  });

  it("splits a list item inside blockquote without moving the list", () => {
    const r = splitListItem(quotedListDoc(), at([0, 0, 0, 0], 2));
    expect(r).not.toBeNull();
    const quote = r!.doc.content[0];
    expect(quote.type).toBe("blockquote");
    expect(quote.content![0].type).toBe("bullet_list");
    expect(quote.content![0].content).toHaveLength(2);
    expect(r!.caret).toEqual([0, 0, 1, 0]);
  });
});

describe("liftListItem", () => {
  it("lifts the only item — list becomes a paragraph", () => {
    const r = liftListItem(emptyItemDoc(), at([1, 0, 0], 0));
    expect(r).not.toBeNull();
    expect(r!.doc.content).toHaveLength(2);
    expect(r!.doc.content[1].type).toBe("paragraph");
    expect(r!.caret).toEqual([1]);
  });

  it("lifts one item — list keeps the rest, paragraph follows", () => {
    // Make the second item empty and lift it.
    const doc = listDoc();
    doc.content[1].content![1].content = [{ type: "paragraph" }];
    const r = liftListItem(doc, at([1, 1, 0], 0));
    expect(r!.doc.content).toHaveLength(3);
    expect(r!.doc.content[1].type).toBe("bullet_list");
    expect(r!.doc.content[1].content).toHaveLength(1);
    expect(r!.doc.content[2].type).toBe("paragraph");
    expect(r!.caret).toEqual([2]);
  });

  it("returns null when the caret is not in a list", () => {
    expect(liftListItem(listDoc(), at([0], 0))).toBeNull();
  });

  it("lifts an empty list item inside blockquote into the quote", () => {
    const r = liftListItem(quotedListDoc(true), at([0, 0, 0, 0], 0));
    expect(r).not.toBeNull();
    const quote = r!.doc.content[0];
    expect(quote.type).toBe("blockquote");
    expect(quote.content![0].type).toBe("paragraph");
    expect(r!.caret).toEqual([0, 0]);
  });
});

describe("sinkListItem", () => {
  it("nests the second item under the first as a new sub-list", () => {
    // Caret in item 1 (the "two" item): bullet_list[1] → item[1] → para[0].
    const r = sinkListItem(listDoc(), at([1, 1, 0], 0));
    expect(r).not.toBeNull();
    const list = r!.doc.content[1];
    // The list now has a single top-level item ("one") holding a nested list.
    expect(list.content).toHaveLength(1);
    const firstItem = list.content![0];
    expect(firstItem.content![0].content![0].text).toBe("one");
    const nested = firstItem.content![1];
    expect(nested.type).toBe("bullet_list");
    expect(nested.content![0].content![0].content![0].text).toBe("two");
    // Caret follows the moved item into the nested list.
    expect(r!.caret).toEqual([1, 0, 1, 0, 0]);
  });

  it("reuses an existing trailing nested list of the same kind", () => {
    const doc: DocumentJSON = {
      type: "doc",
      content: [
        {
          type: "bullet_list",
          content: [
            {
              type: "list_item",
              content: [
                { type: "paragraph", content: [text("one")] },
                {
                  type: "bullet_list",
                  content: [
                    {
                      type: "list_item",
                      content: [{ type: "paragraph", content: [text("a")] }],
                    },
                  ],
                },
              ],
            },
            {
              type: "list_item",
              content: [{ type: "paragraph", content: [text("two")] }],
            },
          ],
        },
      ],
    };
    const r = sinkListItem(doc, at([0, 1, 0], 0));
    expect(r).not.toBeNull();
    const nested = r!.doc.content[0].content![0].content![1];
    expect(nested.type).toBe("bullet_list");
    // "two" appended into the existing nested list after "a".
    expect(nested.content).toHaveLength(2);
    expect(nested.content![1].content![0].content![0].text).toBe("two");
  });

  it("returns null for the first item (nothing to nest under)", () => {
    expect(sinkListItem(listDoc(), at([1, 0, 0], 0))).toBeNull();
  });

  it("returns null when the caret is not in a list", () => {
    expect(sinkListItem(listDoc(), at([0], 0))).toBeNull();
  });
});
