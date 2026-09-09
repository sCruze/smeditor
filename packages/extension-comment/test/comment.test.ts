/**
 * Tests for getCommentThreads — the pure document-inspection helper.
 * Pure: plain DocumentJSON, no editor.
 */

import { describe, it, expect } from "vitest";
import { getCommentThreads } from "../src/index.js";
import type { DocumentJSON } from "@smeditor/core";

function textWithComment(
  text: string,
  threadId: string,
  resolved = false,
): DocumentJSON["content"][number] {
  return {
    type: "text",
    text,
    marks: [{ type: "comment", attrs: { threadId, resolved } }],
  };
}

const doc = (...content: DocumentJSON["content"]): DocumentJSON => ({
  type: "doc",
  content,
});

const para = (
  ...inline: DocumentJSON["content"]
): DocumentJSON["content"][number] => ({
  type: "paragraph",
  content: inline,
});

describe("getCommentThreads", () => {
  it("returns nothing for a document without comments", () => {
    const d = doc(para({ type: "text", text: "plain" }));
    expect(getCommentThreads(d)).toEqual([]);
  });

  it("collects distinct thread ids", () => {
    const d = doc(
      para(textWithComment("hello", "t1")),
      para(textWithComment("world", "t2")),
    );
    const threads = getCommentThreads(d);
    expect(threads.map((t) => t.threadId).sort()).toEqual(["t1", "t2"]);
  });

  it("de-duplicates a thread spanning multiple text nodes", () => {
    const d = doc(
      para(textWithComment("part one", "t1"), textWithComment("part two", "t1")),
    );
    expect(getCommentThreads(d)).toHaveLength(1);
  });

  it("reports a thread resolved only when every mark is resolved", () => {
    const mixed = doc(
      para(
        textWithComment("a", "t1", true),
        textWithComment("b", "t1", false),
      ),
    );
    expect(getCommentThreads(mixed)[0].resolved).toBe(false);

    const allResolved = doc(
      para(textWithComment("a", "t1", true), textWithComment("b", "t1", true)),
    );
    expect(getCommentThreads(allResolved)[0].resolved).toBe(true);
  });
});
