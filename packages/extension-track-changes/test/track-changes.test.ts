/**
 * Tests for track-changes — resolveChanges and getChanges. Pure
 * functions: document in, resolved document / change list out.
 */

import { describe, it, expect } from "vitest";
import {
  resolveChanges,
  resolveChange,
  getChanges,
  insertTrackedText,
  markDeleteAt,
} from "../src/index.js";
import type { DocumentJSON } from "@smeditor/core";

/** A paragraph mixing plain, inserted and deleted text. */
function trackedDoc(): DocumentJSON {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "plain " },
          {
            type: "text",
            text: "added",
            marks: [
              { type: "insertion", attrs: { author: "Ada", timestamp: 1 } },
            ],
          },
          { type: "text", text: " " },
          {
            type: "text",
            text: "removed",
            marks: [
              { type: "deletion", attrs: { author: "Bo", timestamp: 2 } },
            ],
          },
        ],
      },
    ],
  };
}

const blockText = (doc: DocumentJSON): string =>
  (doc.content[0].content ?? []).map((n) => n.text ?? "").join("");

describe("resolveChanges — accept", () => {
  it("keeps insertions and drops deletions", () => {
    const out = resolveChanges(trackedDoc(), "accept");
    expect(blockText(out)).toBe("plain added ");
  });
  it("strips the insertion mark from kept text", () => {
    const out = resolveChanges(trackedDoc(), "accept");
    const added = out.content[0].content!.find((n) => n.text === "added");
    expect(added?.marks).toBeUndefined();
  });
});

describe("resolveChanges — reject", () => {
  it("drops insertions and restores deletions", () => {
    const out = resolveChanges(trackedDoc(), "reject");
    expect(blockText(out)).toBe("plain  removed");
  });
  it("strips the deletion mark from restored text", () => {
    const out = resolveChanges(trackedDoc(), "reject");
    const removed = out.content[0].content!.find(
      (n) => n.text === "removed",
    );
    expect(removed?.marks).toBeUndefined();
  });
});

describe("getChanges", () => {
  it("lists every tracked change with author and text", () => {
    const changes = getChanges(trackedDoc());
    expect(changes).toHaveLength(2);
    expect(changes[0]).toMatchObject({
      type: "insertion",
      author: "Ada",
      text: "added",
    });
    expect(changes[1]).toMatchObject({
      type: "deletion",
      author: "Bo",
      text: "removed",
    });
  });
  it("returns an empty list for a clean document", () => {
    const clean: DocumentJSON = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "hi" }] },
      ],
    };
    expect(getChanges(clean)).toEqual([]);
  });
});

describe("resolveChange — single", () => {
  it("accepts only the targeted insertion", () => {
    // change 0 is the insertion, change 1 the deletion
    const out = resolveChange(trackedDoc(), 0, "accept");
    // insertion accepted (mark stripped), deletion still present
    const added = out.content[0].content!.find((n) => n.text === "added");
    const removed = out.content[0].content!.find((n) => n.text === "removed");
    expect(added?.marks).toBeUndefined();
    expect(removed?.marks?.[0].type).toBe("deletion");
  });

  it("rejects only the targeted deletion", () => {
    const out = resolveChange(trackedDoc(), 1, "reject");
    const removed = out.content[0].content!.find((n) => n.text === "removed");
    const added = out.content[0].content!.find((n) => n.text === "added");
    // deletion rejected (mark stripped), insertion still present
    expect(removed?.marks).toBeUndefined();
    expect(added?.marks?.[0].type).toBe("insertion");
  });

  it("leaves the document unchanged for an out-of-range index", () => {
    const out = resolveChange(trackedDoc(), 9, "accept");
    expect(getChanges(out)).toHaveLength(2);
  });

  it("shares getChanges' index space for a node with both marks", () => {
    // A single text node carries BOTH an insertion and a deletion mark.
    // getChanges emits two entries for it: [insertion@0, deletion@1].
    const bothDoc = (): DocumentJSON => ({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "a" },
            {
              type: "text",
              text: "X",
              marks: [
                { type: "insertion", attrs: { author: "Ada", timestamp: 1 } },
                { type: "deletion", attrs: { author: "Bo", timestamp: 2 } },
              ],
            },
            { type: "text", text: "b" },
          ],
        },
      ],
    });

    // sanity: the two marks occupy indices 0 and 1
    const changes = getChanges(bothDoc());
    expect(changes).toHaveLength(2);
    expect(changes[0].type).toBe("insertion");
    expect(changes[1].type).toBe("deletion");

    // reject index 1 (the deletion) -> strip deletion mark, keep "X"
    const rejected = resolveChange(bothDoc(), 1, "reject");
    const rx = rejected.content[0].content!.find((n) => n.text === "X");
    expect(rx).toBeDefined();
    expect(rx!.marks?.some((m) => m.type === "deletion")).toBe(false);
    expect(rx!.marks?.some((m) => m.type === "insertion")).toBe(true);

    // accept index 0 (the insertion) -> strip insertion mark, keep "X"
    const accepted = resolveChange(bothDoc(), 0, "accept");
    const ax = accepted.content[0].content!.find((n) => n.text === "X");
    expect(ax).toBeDefined();
    expect(ax!.marks?.some((m) => m.type === "insertion")).toBe(false);
    expect(ax!.marks?.some((m) => m.type === "deletion")).toBe(true);
  });
});

describe("insertTrackedText", () => {
  it("inserts text wrapped in an insertion mark", () => {
    const doc: DocumentJSON = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "helo" }] },
      ],
    };
    // insert "l" at offset 3 -> "hello"
    const r = insertTrackedText(doc, { path: [0], offset: 3 }, "l", "Ada");
    expect(r).not.toBeNull();
    const para = r!.doc.content[0];
    const joined = (para.content ?? []).map((n) => n.text).join("");
    expect(joined).toBe("hello");
    const mark = para.content!.find((n) => n.text === "l")?.marks?.[0];
    expect(mark?.type).toBe("insertion");
    expect(mark?.attrs?.author).toBe("Ada");
    expect(r!.caret.offset).toBe(4);
  });
});

describe("markDeleteAt", () => {
  it("marks the previous character on backward delete", () => {
    const doc: DocumentJSON = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "abc" }] },
      ],
    };
    // caret after "abc"; backward delete marks "c"
    const r = markDeleteAt(doc, { path: [0], offset: 3 }, "backward", "Bo");
    expect(r).not.toBeNull();
    const last = r!.doc.content[0].content!.slice(-1)[0];
    expect(last.text).toBe("c");
    expect(last.marks?.[0].type).toBe("deletion");
    expect(r!.caret.offset).toBe(2);
  });

  it("marks the next character on forward delete", () => {
    const doc: DocumentJSON = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "abc" }] },
      ],
    };
    const r = markDeleteAt(doc, { path: [0], offset: 0 }, "forward", "Bo");
    const first = r!.doc.content[0].content![0];
    expect(first.text).toBe("a");
    expect(first.marks?.[0].type).toBe("deletion");
    expect(r!.caret.offset).toBe(0);
  });

  it("returns null at a boundary", () => {
    const doc: DocumentJSON = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "abc" }] },
      ],
    };
    expect(markDeleteAt(doc, { path: [0], offset: 0 }, "backward", null))
      .toBeNull();
  });
});
