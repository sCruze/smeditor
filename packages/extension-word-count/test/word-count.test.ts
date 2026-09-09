/**
 * Tests for the word-count helpers — getPlainText / countCharacters /
 * countWords. Pure functions: a document JSON in, a number (or string) out.
 *
 * Covers the two fixed bugs:
 *   A — countCharacters used to over-count by one trailing space per
 *       top-level block (empty doc reported 1, "hello" reported 6).
 *   B — countWords used to merge words across nested sibling blocks
 *       (two list items / table cells ran together into one token).
 */

import { describe, it, expect } from "vitest";
import { createEditor } from "@smeditor/core";
import {
  getPlainText,
  countCharacters,
  countWords,
  WordCountExtension,
} from "../src/index.js";
import type {
  DocumentJSON,
  DocumentNode,
  EditorInstance,
} from "@smeditor/core";

const text = (t: string, marks?: { type: string }[]): DocumentNode =>
  marks ? { type: "text", text: t, marks } : { type: "text", text: t };

const doc = (...content: DocumentNode[]): DocumentJSON => ({ type: "doc", content });
const para = (...content: DocumentNode[]): DocumentNode => ({ type: "paragraph", content });

describe("countCharacters (Bug A — trailing space over-count)", () => {
  it("empty document counts 0 characters", () => {
    expect(countCharacters(doc())).toBe(0);
  });

  it("empty paragraph counts 0 characters", () => {
    expect(countCharacters(doc(para()))).toBe(0);
  });

  it("single paragraph 'hello' counts 5 characters", () => {
    expect(countCharacters(doc(para(text("hello"))))).toBe(5);
  });

  it("two paragraphs 'a' and 'bb' count 4 (a + space + bb)", () => {
    expect(countCharacters(doc(para(text("a")), para(text("bb"))))).toBe(4);
  });

  it("includeSpaces:false strips whitespace and is unaffected", () => {
    const d = doc(para(text("a")), para(text("bb")));
    expect(countCharacters(d, { includeSpaces: false })).toBe(3);
  });

  it("includeSpaces:false on empty doc counts 0", () => {
    expect(countCharacters(doc(), { includeSpaces: false })).toBe(0);
  });
});

describe("countWords (Bug B — words merged across nested blocks)", () => {
  it("empty document counts 0 words", () => {
    expect(countWords(doc())).toBe(0);
  });

  it("bullet list with two items 'one' and 'two' counts 2 words", () => {
    const d = doc({
      type: "bullet_list",
      content: [
        { type: "list_item", content: [para(text("one"))] },
        { type: "list_item", content: [para(text("two"))] },
      ],
    });
    expect(countWords(d)).toBe(2);
  });

  it("table with two cells counts both cells as separate words", () => {
    const d = doc({
      type: "table",
      content: [
        {
          type: "table_row",
          content: [
            { type: "table_cell", content: [para(text("alpha"))] },
            { type: "table_cell", content: [para(text("beta"))] },
          ],
        },
      ],
    });
    expect(countWords(d)).toBe(2);
  });

  it("blockquote with two paragraphs does not merge their words", () => {
    const d = doc({
      type: "blockquote",
      content: [para(text("first")), para(text("second"))],
    });
    expect(countWords(d)).toBe(2);
  });

  it("'hello ' + bold 'world' counts 2 words", () => {
    const d = doc(para(text("hello "), text("world", [{ type: "bold" }])));
    expect(countWords(d)).toBe(2);
  });

  it("a single word split across two adjacent text leaves counts 1 word", () => {
    const d = doc(para(text("wor"), text("ld", [{ type: "bold" }])));
    expect(countWords(d)).toBe(1);
  });
});

describe("limit enforcement (opt-in via configure)", () => {
  // A headless editor whose document holds `content`. handleTextInput
  // reads editor.getJSON() to compute the current count, so this is all
  // the setup the hook needs.
  const editorWith = (content: DocumentJSON): EditorInstance => {
    const editor = createEditor({ extensions: [WordCountExtension] });
    editor.setContent(content);
    return editor;
  };

  it("the unconfigured WordCountExtension has no handleTextInput (never blocks)", () => {
    // No enforcement hook at all — preserves the original behavior.
    expect(WordCountExtension.handleTextInput).toBeUndefined();
  });

  it("configure does not mutate the original (default export stays unconfigured)", () => {
    WordCountExtension.configure!({ limit: 5 });
    expect(WordCountExtension.handleTextInput).toBeUndefined();
  });

  describe("characters mode", () => {
    const limited = WordCountExtension.configure!({
      limit: 5,
      mode: "characters",
    });

    it("blocks input once the document is at the limit ('hello' = 5 chars)", () => {
      const editor = editorWith(doc(para(text("hello"))));
      expect(limited.handleTextInput!(editor, "x")).toBe(true);
    });

    it("allows one more char below the limit ('hell' = 4 chars)", () => {
      const editor = editorWith(doc(para(text("hell"))));
      expect(limited.handleTextInput!(editor, "x")).toBe(false);
    });

    it("blocks a multi-char insertion that would overflow", () => {
      const editor = editorWith(doc(para(text("hell")))); // 4, limit 5
      expect(limited.handleTextInput!(editor, "lo")).toBe(true); // 4 + 2 > 5
    });

    it("defaults mode to 'characters' when omitted", () => {
      const def = WordCountExtension.configure!({ limit: 5 });
      const editor = editorWith(doc(para(text("hello"))));
      expect(def.handleTextInput!(editor, "x")).toBe(true);
    });
  });

  describe("words mode", () => {
    const limited = WordCountExtension.configure!({ limit: 2, mode: "words" });

    it("blocks a new word once at the word limit (2 words)", () => {
      const editor = editorWith(doc(para(text("one two"))));
      expect(limited.handleTextInput!(editor, "x")).toBe(true);
    });

    it("allows starting a new word below the limit (1 word)", () => {
      const editor = editorWith(doc(para(text("one"))));
      expect(limited.handleTextInput!(editor, "x")).toBe(false);
    });

    it("allows whitespace even at the limit (it doesn't start a word)", () => {
      const editor = editorWith(doc(para(text("one two"))));
      expect(limited.handleTextInput!(editor, " ")).toBe(false);
    });
  });
});

describe("getPlainText", () => {
  it("empty document yields an empty string", () => {
    expect(getPlainText(doc())).toBe("");
  });

  it("joins top-level blocks with a single space and no trailing space", () => {
    expect(getPlainText(doc(para(text("a")), para(text("bb"))))).toBe("a bb");
  });

  it("separates nested sibling blocks with whitespace", () => {
    const d = doc({
      type: "bullet_list",
      content: [
        { type: "list_item", content: [para(text("one"))] },
        { type: "list_item", content: [para(text("two"))] },
      ],
    });
    // No leading text concatenation: "one" and "two" must be separated.
    expect(getPlainText(d).trim().split(/\s+/)).toEqual(["one", "two"]);
  });

  it("keeps adjacent text leaves un-separated", () => {
    expect(getPlainText(doc(para(text("wor"), text("ld"))))).toBe("world");
  });
});
