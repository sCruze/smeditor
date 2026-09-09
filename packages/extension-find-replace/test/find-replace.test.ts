import { describe, it, expect } from "vitest";
import { createEditor, type DocumentJSON } from "@smeditor/core";
import { FindReplaceExtension, findMatches } from "../src/index.js";

/** A two-paragraph document used across the navigation/replace tests. */
function twoParagraphDoc(): DocumentJSON {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "the cat sat on the mat" }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "the dog ran the race" }],
      },
    ],
  };
}

function makeEditor(content: DocumentJSON = twoParagraphDoc()) {
  return createEditor({
    content,
    extensions: [FindReplaceExtension],
    deepSelection: true,
  });
}

/** Concatenate the visible text of each top-level paragraph. */
function blockTexts(json: DocumentJSON): string[] {
  return (json.content ?? []).map((block) =>
    (block.content ?? [])
      .map((n) => (n.type === "text" ? n.text ?? "" : ""))
      .join(""),
  );
}

describe("findMatches", () => {
  it("finds matches in both blocks with correct path/from/to", () => {
    const doc = twoParagraphDoc();
    const matches = findMatches(doc, "the");

    // "the cat sat on the mat" → offsets 0 and 15
    // "the dog ran the race"   → offsets 0 and 12
    expect(matches).toEqual([
      { path: [0], from: 0, to: 3 },
      { path: [0], from: 15, to: 18 },
      { path: [1], from: 0, to: 3 },
      { path: [1], from: 12, to: 15 },
    ]);
  });

  it("is case-insensitive by default and respects caseSensitive", () => {
    const doc: DocumentJSON = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "The the THE" }],
        },
      ],
    };

    expect(findMatches(doc, "the").map((m) => m.from)).toEqual([0, 4, 8]);
    expect(
      findMatches(doc, "the", { caseSensitive: true }).map((m) => m.from),
    ).toEqual([4]);
  });

  it("matches whole words only when wholeWord is set", () => {
    const doc: DocumentJSON = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "cat category scatter cat" }],
        },
      ],
    };

    // Plain search finds the "cat" inside "category" and "scatter".
    expect(findMatches(doc, "cat").length).toBe(4);

    // Whole-word search excludes the in-word occurrences.
    const whole = findMatches(doc, "cat", { wholeWord: true });
    expect(whole).toEqual([
      { path: [0], from: 0, to: 3 },
      { path: [0], from: 21, to: 24 },
    ]);
  });

  it("returns nothing for an empty query", () => {
    expect(findMatches(twoParagraphDoc(), "")).toEqual([]);
  });
});

describe("replaceAll", () => {
  it("replaces every occurrence across blocks", () => {
    const editor = makeEditor();

    expect(
      editor.commands.replaceAll?.({ query: "the", replacement: "a" }),
    ).toBe(true);

    expect(blockTexts(editor.getJSON())).toEqual([
      "a cat sat on a mat",
      "a dog ran a race",
    ]);
  });

  it("can delete matches with an empty replacement", () => {
    const editor = makeEditor();

    expect(
      editor.commands.replaceAll?.({ query: "the ", replacement: "" }),
    ).toBe(true);

    expect(blockTexts(editor.getJSON())).toEqual([
      "cat sat on mat",
      "dog ran race",
    ]);
  });

  it("returns false when there is no match", () => {
    const editor = makeEditor();

    expect(
      editor.commands.replaceAll?.({ query: "zebra", replacement: "x" }),
    ).toBe(false);
    expect(blockTexts(editor.getJSON())).toEqual([
      "the cat sat on the mat",
      "the dog ran the race",
    ]);
  });
});

describe("findNext", () => {
  it("selects the first match, then advances and wraps around", () => {
    const editor = makeEditor();
    editor.setSelection({
      anchor: { path: [0], offset: 0 },
      head: { path: [0], offset: 0 },
    });

    // First call: selects the first "the".
    expect(editor.commands.findNext?.({ query: "the" })).toBe(true);
    expect(editor.getSelection()).toEqual({
      anchor: { path: [0], offset: 0 },
      head: { path: [0], offset: 3 },
    });

    // Second call: advances to the second "the" in the first paragraph.
    expect(editor.commands.findNext?.({ query: "the" })).toBe(true);
    expect(editor.getSelection()).toEqual({
      anchor: { path: [0], offset: 15 },
      head: { path: [0], offset: 18 },
    });

    // Third call: into the second paragraph.
    expect(editor.commands.findNext?.({ query: "the" })).toBe(true);
    expect(editor.getSelection()).toEqual({
      anchor: { path: [1], offset: 0 },
      head: { path: [1], offset: 3 },
    });

    // Fourth: last match in the second paragraph.
    expect(editor.commands.findNext?.({ query: "the" })).toBe(true);
    expect(editor.getSelection()).toEqual({
      anchor: { path: [1], offset: 12 },
      head: { path: [1], offset: 15 },
    });

    // Fifth: wraps back to the very first match.
    expect(editor.commands.findNext?.({ query: "the" })).toBe(true);
    expect(editor.getSelection()).toEqual({
      anchor: { path: [0], offset: 0 },
      head: { path: [0], offset: 3 },
    });
  });

  it("returns false when there is no match", () => {
    const editor = makeEditor();
    expect(editor.commands.findNext?.({ query: "zebra" })).toBe(false);
  });
});

describe("findPrevious", () => {
  it("selects the previous match and wraps to the last", () => {
    const editor = makeEditor();

    // No selection → wrap to the last match.
    expect(editor.commands.findPrevious?.({ query: "the" })).toBe(true);
    expect(editor.getSelection()).toEqual({
      anchor: { path: [1], offset: 12 },
      head: { path: [1], offset: 15 },
    });

    // Now step backwards.
    expect(editor.commands.findPrevious?.({ query: "the" })).toBe(true);
    expect(editor.getSelection()).toEqual({
      anchor: { path: [1], offset: 0 },
      head: { path: [1], offset: 3 },
    });
  });
});

describe("replaceNext", () => {
  it("replaces the current match then moves to the next", () => {
    const editor = makeEditor();

    // First call (no exact selection): just moves to the first match.
    expect(
      editor.commands.replaceNext?.({ query: "the", replacement: "a" }),
    ).toBe(true);
    expect(editor.getSelection()).toEqual({
      anchor: { path: [0], offset: 0 },
      head: { path: [0], offset: 3 },
    });

    // Second call: selection exactly equals a match → replace + advance.
    expect(
      editor.commands.replaceNext?.({ query: "the", replacement: "a" }),
    ).toBe(true);

    const texts = blockTexts(editor.getJSON());
    expect(texts[0]).toBe("a cat sat on the mat");
  });
});
