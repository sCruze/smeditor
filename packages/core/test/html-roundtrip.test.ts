/**
 * Regression tests for HTML/JSON round-trips in the headless parser.
 * Vitest runs core in Node, where DOMParser is absent, so these cover
 * the fallback path used by SSR and tests.
 */

import { describe, it, expect } from "vitest";
import { compileSchema, parseHTML, serializeToHTML } from "../src/index.js";
import type { CompiledSchema, DocumentNode, Mark } from "../src/index.js";

const schema: CompiledSchema = compileSchema([
  {
    name: "html-roundtrip-fixture",
    nodes: [
      {
        name: "paragraph",
        group: "block",
        content: "inline*",
        toDOM: () => ["p", 0],
        parseDOM: [{ tag: "p" }],
      },
      {
        name: "blockquote",
        group: "block",
        content: "block+",
        toDOM: () => ["blockquote", 0],
        parseDOM: [{ tag: "blockquote" }],
      },
      {
        name: "bullet_list",
        group: "block",
        content: "list_item+",
        toDOM: () => ["ul", 0],
        parseDOM: [{ tag: "ul" }],
      },
      {
        name: "list_item",
        group: "block",
        content: "block+",
        toDOM: () => ["li", 0],
        parseDOM: [{ tag: "li" }],
      },
      {
        name: "table",
        group: "block",
        content: "table_row+",
        toDOM: () => ["table", 0],
        parseDOM: [{ tag: "table" }],
      },
      {
        name: "table_row",
        group: "block",
        content: "table_cell+",
        toDOM: () => ["tr", 0],
        parseDOM: [{ tag: "tr" }],
      },
      {
        name: "table_cell",
        group: "block",
        content: "block+",
        toDOM: () => ["td", 0],
        parseDOM: [{ tag: "td" }],
      },
      {
        name: "code_block",
        group: "block",
        content: "text*",
        attrs: { language: { default: null } },
        toDOM: (node) => {
          const language = node.attrs?.language;
          return typeof language === "string" && language
            ? ["pre", { class: `language-${language}` }, 0]
            : ["pre", 0];
        },
        parseDOM: [
          {
            tag: "pre",
            getAttrs: (el) => {
              const code = el.querySelector("code");
              const klass =
                code?.getAttribute("class") ?? el.getAttribute("class") ?? "";
              const match = /language-([\w-]+)/.exec(klass);
              return match ? { language: match[1] } : null;
            },
          },
        ],
      },
    ],
    marks: [
      {
        name: "bold",
        toDOM: () => ["strong", 0],
        parseDOM: [{ tag: "strong" }, { tag: "b" }],
      },
      {
        name: "italic",
        toDOM: () => ["em", 0],
        parseDOM: [{ tag: "em" }, { tag: "i" }],
      },
      {
        name: "strike",
        toDOM: () => ["s", 0],
        parseDOM: [{ tag: "s" }, { tag: "strike" }, { tag: "del" }],
      },
      {
        name: "link",
        attrs: { href: {} },
        toDOM: (mark) => ["a", { href: String(mark.attrs?.href ?? "") }, 0],
        parseDOM: [
          {
            tag: "a",
            getAttrs: (el) => {
              const href = el.getAttribute("href") ?? "";
              return href.startsWith("javascript:") ? false : { href };
            },
          },
        ],
      },
      {
        name: "text_color",
        attrs: { color: { default: null } },
        toDOM: (mark) => ["span", { style: `color: ${mark.attrs?.color}` }, 0],
        parseDOM: [
          {
            tag: "*",
            getAttrs: (el) => {
              const match = /(?:^|;)\s*color\s*:\s*([^;]+)/i.exec(
                el.getAttribute("style") ?? "",
              );
              return match ? { color: match[1].trim() } : false;
            },
          },
        ],
      },
      {
        name: "background_color",
        attrs: { color: { default: null } },
        toDOM: (mark) => [
          "span",
          { style: `background-color: ${mark.attrs?.color}` },
          0,
        ],
        parseDOM: [
          {
            tag: "*",
            getAttrs: (el) => {
              if (el.tagName.toLowerCase() === "mark") return false;
              const match = /background(?:-color)?\s*:\s*([^;]+)/i.exec(
                el.getAttribute("style") ?? "",
              );
              return match ? { color: match[1].trim() } : false;
            },
          },
        ],
      },
      {
        name: "highlight",
        attrs: { color: { default: null } },
        toDOM: (mark) =>
          mark.attrs?.color
            ? ["mark", { style: `background-color: ${mark.attrs.color}` }, 0]
            : ["mark", 0],
        parseDOM: [
          {
            tag: "mark",
            getAttrs: (el) => {
              const match = /background(?:-color)?\s*:\s*([^;]+)/i.exec(
                el.getAttribute("style") ?? "",
              );
              return match ? { color: match[1].trim() } : null;
            },
          },
        ],
      },
      {
        name: "font_size",
        attrs: { size: { default: null } },
        toDOM: (mark) => [
          "span",
          { style: `font-size: ${mark.attrs?.size}` },
          0,
        ],
        parseDOM: [
          {
            tag: "*",
            getAttrs: (el) => {
              const match = /font-size\s*:\s*([^;]+)/i.exec(
                el.getAttribute("style") ?? "",
              );
              return match ? { size: match[1].trim() } : false;
            },
          },
        ],
      },
      {
        name: "font_family",
        attrs: { family: { default: null } },
        toDOM: (mark) => [
          "span",
          { style: `font-family: ${mark.attrs?.family}` },
          0,
        ],
        parseDOM: [
          {
            tag: "*",
            getAttrs: (el) => {
              const match = /font-family\s*:\s*([^;]+)/i.exec(
                el.getAttribute("style") ?? "",
              );
              return match ? { family: match[1].trim() } : false;
            },
          },
        ],
      },
      {
        name: "text_stroke",
        attrs: { color: { default: null }, width: { default: "1px" } },
        toDOM: (mark) => [
          "span",
          {
            style: `-webkit-text-stroke: ${mark.attrs?.width} ${mark.attrs?.color}`,
          },
          0,
        ],
        parseDOM: [
          {
            tag: "*",
            getAttrs: (el) => {
              const match = /(?:^|;)\s*-webkit-text-stroke\s*:\s*([^\s;]+)\s+([^;]+)/i.exec(
                el.getAttribute("style") ?? "",
              );
              return match
                ? { width: match[1].trim(), color: match[2].trim() }
                : false;
            },
          },
        ],
      },
    ],
  },
]);

function textNodes(node: DocumentNode): DocumentNode[] {
  const own = node.type === "text" ? [node] : [];
  const children = node.content ?? [];
  return [...own, ...children.flatMap((child) => textNodes(child))];
}

function markTypes(marks: Mark[] | undefined): string[] {
  return (marks ?? []).map((mark) => mark.type);
}

describe("HTML round-trip", () => {
  it("keeps multiple marks and mark attributes on one text node", () => {
    const parsed = parseHTML(
      '<p><a href="/safe"><strong><span style="color: #f00; background-color: yellow; font-size: 18px; font-family: Arial; -webkit-text-stroke: 1px blue"><mark style="background-color: lime">Rich</mark></span></strong></a></p><script>alert(1)</script>',
      schema,
    );
    const text = textNodes(parsed)[0];
    const reparsed = parseHTML(serializeToHTML(parsed, schema), schema);
    const roundTripped = textNodes(reparsed)[0];

    expect(text.text).toBe("Rich");
    expect(textNodes(parsed).map((node) => node.text).join("")).not.toContain(
      "alert",
    );
    expect(markTypes(roundTripped.marks)).toEqual(
      expect.arrayContaining([
        "link",
        "bold",
        "text_color",
        "background_color",
        "font_size",
        "font_family",
        "text_stroke",
        "highlight",
      ]),
    );
    expect(roundTripped.marks?.find((mark) => mark.type === "link")?.attrs).toEqual({
      href: "/safe",
    });
    expect(
      roundTripped.marks?.find((mark) => mark.type === "text_stroke")?.attrs,
    ).toEqual({ width: "1px", color: "blue" });
  });

  it("keeps nested blockquote, list, table and code block structure", () => {
    const parsed = parseHTML(
      '<blockquote><ul><li><p><em>Item</em></p></li></ul><table><tbody><tr><td><p><s>Cell</s></p></td></tr></tbody></table><pre><code class="language-ts">const x = 1;</code></pre></blockquote>',
      schema,
    );
    const blockquote = parsed.content[0];
    const code = blockquote.content?.[2];

    expect(blockquote.type).toBe("blockquote");
    expect(blockquote.content?.[0].type).toBe("bullet_list");
    expect(blockquote.content?.[1].type).toBe("table");
    expect(code?.type).toBe("code_block");
    expect(code?.attrs).toEqual({ language: "ts" });
    expect(
      textNodes(blockquote).find((node) => node.text === "Item")?.marks?.[0]
        .type,
    ).toBe("italic");
    expect(
      textNodes(blockquote).find((node) => node.text === "Cell")?.marks?.[0]
        .type,
    ).toBe("strike");
  });

  it("keeps unsafe links as text without restoring the link mark", () => {
    const parsed = parseHTML('<p><a href="javascript:alert(1)">Click</a></p>', schema);
    const text = textNodes(parsed)[0];

    expect(text.text).toBe("Click");
    expect(markTypes(text.marks)).not.toContain("link");
  });
});
