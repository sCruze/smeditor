/**
 * Tests for Markdown serialization (toMarkdown) and parsing
 * (fromMarkdown). Pure — no DOM, no editor.
 */

import { describe, it, expect } from "vitest";
import { toMarkdown } from "../src/to-markdown.js";
import { fromMarkdown } from "../src/from-markdown.js";
import type { DocumentJSON } from "@smeditor/core";

const doc = (...content: DocumentJSON["content"]): DocumentJSON => ({
  type: "doc",
  content,
});
const para = (text: string) => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});

describe("toMarkdown", () => {
  it("serializes headings", () => {
    const d = doc({
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Title" }],
    });
    expect(toMarkdown(d)).toBe("## Title\n");
  });

  it("serializes bold and italic marks", () => {
    const d = doc({
      type: "paragraph",
      content: [
        { type: "text", text: "a", marks: [{ type: "bold" }] },
        { type: "text", text: "b", marks: [{ type: "italic" }] },
      ],
    });
    expect(toMarkdown(d)).toBe("**a***b*\n");
  });

  it("serializes links", () => {
    const d = doc({
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "site",
          marks: [{ type: "link", attrs: { href: "https://x.com" } }],
        },
      ],
    });
    expect(toMarkdown(d)).toBe("[site](https://x.com)\n");
  });

  it("serializes a bullet list", () => {
    const d = doc({
      type: "bullet_list",
      content: [
        { type: "list_item", content: [para("one")] },
        { type: "list_item", content: [para("two")] },
      ],
    });
    expect(toMarkdown(d)).toBe("- one\n- two\n");
  });

  it("serializes a code block", () => {
    const d = doc({
      type: "code_block",
      content: [{ type: "text", text: "x = 1" }],
    });
    expect(toMarkdown(d)).toBe("```\nx = 1\n```\n");
  });

  it("serializes a horizontal rule", () => {
    expect(toMarkdown(doc({ type: "horizontal_rule" }))).toBe("---\n");
  });
});

describe("fromMarkdown", () => {
  it("parses headings", () => {
    const d = fromMarkdown("### Hello");
    expect(d.content[0].type).toBe("heading");
    expect(d.content[0].attrs?.level).toBe(3);
  });

  it("parses bold and italic", () => {
    const d = fromMarkdown("**bold** and *italic*");
    const marks = d.content[0].content?.map((n) => n.marks?.[0]?.type);
    expect(marks).toContain("bold");
    expect(marks).toContain("italic");
  });

  it("parses a bullet list", () => {
    const d = fromMarkdown("- one\n- two");
    expect(d.content[0].type).toBe("bullet_list");
    expect(d.content[0].content).toHaveLength(2);
  });

  it("parses a fenced code block", () => {
    const d = fromMarkdown("```\nx = 1\n```");
    expect(d.content[0].type).toBe("code_block");
    expect(d.content[0].content?.[0].text).toBe("x = 1");
  });

  it("parses a horizontal rule", () => {
    expect(fromMarkdown("---").content[0].type).toBe("horizontal_rule");
  });

  it("falls back to a paragraph for plain text", () => {
    const d = fromMarkdown("just some text");
    expect(d.content[0].type).toBe("paragraph");
  });
});

describe("round-trip", () => {
  it("survives a heading + paragraph + list round-trip", () => {
    const md = "# Title\n\nA paragraph.\n\n- item one\n- item two\n";
    const back = toMarkdown(fromMarkdown(md));
    expect(back).toBe(md);
  });
});

describe("nested lists", () => {
  it("nests a bullet list under an item", () => {
    const d = fromMarkdown("- one\n  - sub a\n  - sub b\n- two");
    const list = d.content[0];
    expect(list.type).toBe("bullet_list");
    expect(list.content).toHaveLength(2);
    const firstItem = list.content![0];
    // paragraph + nested list
    expect(firstItem.content).toHaveLength(2);
    expect(firstItem.content![1].type).toBe("bullet_list");
    expect(firstItem.content![1].content).toHaveLength(2);
  });

  it("nests an ordered list under a bullet item", () => {
    const d = fromMarkdown("- top\n  1. first\n  2. second");
    const nested = d.content[0].content![0].content![1];
    expect(nested.type).toBe("ordered_list");
    expect(nested.content).toHaveLength(2);
  });
});

describe("reference links", () => {
  it("resolves a full reference link", () => {
    const d = fromMarkdown("See [the site][ref].\n\n[ref]: https://example.com");
    const para = d.content[0];
    const linked = para.content!.find((n) => n.marks?.[0]?.type === "link");
    expect(linked?.marks?.[0].attrs?.href).toBe("https://example.com");
  });

  it("resolves a shortcut reference link", () => {
    const d = fromMarkdown("Check [docs].\n\n[docs]: https://docs.example.com");
    const linked = d.content[0].content!.find(
      (n) => n.marks?.[0]?.type === "link",
    );
    expect(linked?.marks?.[0].attrs?.href).toBe("https://docs.example.com");
  });

  it("leaves an undefined reference as literal text", () => {
    const d = fromMarkdown("Just [brackets] here.");
    const linked = d.content[0].content!.find(
      (n) => n.marks?.[0]?.type === "link",
    );
    expect(linked).toBeUndefined();
  });
});

describe("setext headings", () => {
  it("parses an = underline as h1", () => {
    const d = fromMarkdown("Title\n=====");
    expect(d.content[0].type).toBe("heading");
    expect(d.content[0].attrs?.level).toBe(1);
  });

  it("parses a - underline as h2", () => {
    const d = fromMarkdown("Subtitle\n--------");
    expect(d.content[0].type).toBe("heading");
    expect(d.content[0].attrs?.level).toBe(2);
  });
});
