/**
 * Tests for the input-rule helpers added in v0.0.4:
 *   - getBlockText      — concatenated inline text of a block
 *   - stripBlockPrefix  — drop leading characters, keep marks intact
 *
 * These run headlessly — no DOM, no editor instance.
 */

import { describe, it, expect } from "vitest";
import { getBlockText, stripBlockPrefix } from "../src/doc-utils.js";
import type { DocumentNode } from "../src/index.js";

describe("getBlockText", () => {
  it("returns the concatenated text of a block", () => {
    const block: DocumentNode = {
      type: "paragraph",
      content: [
        { type: "text", text: "Hello " },
        { type: "text", text: "world" },
      ],
    };
    expect(getBlockText(block)).toBe("Hello world");
  });

  it("returns an empty string for a block with no content", () => {
    expect(getBlockText({ type: "paragraph" })).toBe("");
    expect(getBlockText({ type: "paragraph", content: [] })).toBe("");
  });

  it("ignores non-text inline nodes", () => {
    const block: DocumentNode = {
      type: "paragraph",
      content: [
        { type: "text", text: "before" },
        { type: "hard_break" },
        { type: "text", text: "after" },
      ],
    };
    expect(getBlockText(block)).toBe("beforeafter");
  });
});

describe("stripBlockPrefix", () => {
  it("removes the first N characters", () => {
    const block: DocumentNode = {
      type: "paragraph",
      content: [{ type: "text", text: "## Heading" }],
    };
    stripBlockPrefix(block, 3);
    expect(getBlockText(block)).toBe("Heading");
  });

  it("preserves marks on the surviving text", () => {
    const block: DocumentNode = {
      type: "paragraph",
      content: [
        { type: "text", text: "> " },
        { type: "text", text: "quoted", marks: [{ type: "bold" }] },
      ],
    };
    stripBlockPrefix(block, 2);
    expect(block.content).toHaveLength(1);
    expect(block.content?.[0].text).toBe("quoted");
    expect(block.content?.[0].marks).toEqual([{ type: "bold" }]);
  });

  it("can slice across multiple text nodes", () => {
    const block: DocumentNode = {
      type: "paragraph",
      content: [
        { type: "text", text: "ab" },
        { type: "text", text: "cdef" },
      ],
    };
    stripBlockPrefix(block, 3);
    expect(getBlockText(block)).toBe("def");
  });

  it("is a no-op for count <= 0", () => {
    const block: DocumentNode = {
      type: "paragraph",
      content: [{ type: "text", text: "unchanged" }],
    };
    stripBlockPrefix(block, 0);
    expect(getBlockText(block)).toBe("unchanged");
  });
});
