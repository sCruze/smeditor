/**
 * Tests for the Transform API — offset-aware inline transforms.
 */

import { describe, it, expect } from "vitest";
import {
  visibleLength,
  inlineLength,
  blockVisibleText,
  splitInlineAt,
  insertInlineAt,
  deleteInlineRange,
  replaceInlineRange,
  applyMarkToInlineRange,
  splitBlock,
} from "../src/transform.js";
import type { DocumentNode, DocumentJSON } from "../src/types.js";

const text = (t: string, marks?: DocumentNode["marks"]): DocumentNode =>
  marks ? { type: "text", text: t, marks } : { type: "text", text: t };

const mention = (label: string): DocumentNode => ({
  type: "mention",
  attrs: { id: "x", label },
  content: [text("@" + label)],
});

describe("measurement", () => {
  it("measures text and atomic nodes", () => {
    expect(visibleLength(text("hello"))).toBe(5);
    expect(visibleLength(mention("ada"))).toBe(4); // "@ada"
  });

  it("sums a block's inline length", () => {
    const block: DocumentNode = {
      type: "paragraph",
      content: [text("hi "), mention("ada"), text("!")],
    };
    expect(inlineLength(block)).toBe(8); // "hi " + "@ada" + "!"
  });

  it("reads visible text through atomic nodes", () => {
    const block: DocumentNode = {
      type: "paragraph",
      content: [text("hi "), mention("ada")],
    };
    expect(blockVisibleText(block)).toBe("hi @ada");
  });
});

describe("splitInlineAt", () => {
  it("splits a text node, preserving marks", () => {
    const bold = [{ type: "bold" }];
    const [before, after] = splitInlineAt([text("abcdef", bold)], 3);
    expect(before).toEqual([text("abc", bold)]);
    expect(after).toEqual([text("def", bold)]);
  });

  it("splits at a node boundary", () => {
    const [before, after] = splitInlineAt([text("ab"), text("cd")], 2);
    expect(before).toEqual([text("ab")]);
    expect(after).toEqual([text("cd")]);
  });

  it("keeps an atomic node whole", () => {
    const content = [text("hi "), mention("ada"), text("!")];
    const [before, after] = splitInlineAt(content, 4); // inside "@ada"
    // Mention is atomic — it lands entirely on one side.
    const all = [...before, ...after];
    expect(all.filter((n) => n.type === "mention")).toHaveLength(1);
  });
});

describe("insert / delete / replace", () => {
  it("inserts in the middle of text", () => {
    const out = insertInlineAt([text("abef")], 2, [text("cd")]);
    expect(blockVisibleText({ type: "p", content: out })).toBe("abcdef");
  });

  it("deletes a range", () => {
    const out = deleteInlineRange([text("abcdef")], 2, 4);
    expect(blockVisibleText({ type: "p", content: out })).toBe("abef");
  });

  it("replaces a range with a node", () => {
    const out = replaceInlineRange([text("hi @jo")], 3, 6, [mention("john")]);
    expect(blockVisibleText({ type: "p", content: out })).toBe("hi @john");
  });
});

describe("applyMarkToInlineRange", () => {
  it("marks exactly the selected span", () => {
    const out = applyMarkToInlineRange(
      [text("abcdef")],
      2,
      4,
      { type: "comment", attrs: { threadId: "t1" } },
    );
    // "ab" | "cd"(marked) | "ef"
    expect(out).toHaveLength(3);
    expect(out[1].marks?.[0].type).toBe("comment");
    expect(out[0].marks).toBeUndefined();
    expect(out[2].marks).toBeUndefined();
  });

  it("does not duplicate an identical mark", () => {
    const mark = { type: "comment", attrs: { threadId: "t1" } };
    const once = applyMarkToInlineRange([text("abcd")], 0, 4, mark);
    const twice = applyMarkToInlineRange(once, 0, 4, mark);
    expect(twice[0].marks).toHaveLength(1);
  });
});

describe("splitBlock", () => {
  it("splits a paragraph into two", () => {
    const doc: DocumentJSON = {
      type: "doc",
      content: [{ type: "paragraph", content: [text("hello world")] }],
    };
    const out = splitBlock(doc, 0, 5);
    expect(out.content).toHaveLength(2);
    expect(blockVisibleText(out.content[0])).toBe("hello");
    expect(blockVisibleText(out.content[1])).toBe(" world");
  });
});
