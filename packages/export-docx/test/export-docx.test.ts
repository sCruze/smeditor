/**
 * Tests for @smeditor/export-docx.
 *
 * The pure `documentXml` mapping is checked directly; `exportDocx` is
 * checked by unzipping the result and verifying the part structure.
 */

import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { documentXml, exportDocx } from "../src/index.js";
import type { DocumentJSON } from "@smeditor/core";

const text = (t: string, marks?: { type: string }[]) => ({
  type: "text",
  text: t,
  ...(marks ? { marks } : {}),
});

function sampleDoc(): DocumentJSON {
  return {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
        content: [text("Title")],
      },
      {
        type: "paragraph",
        content: [
          text("Plain and "),
          text("bold", [{ type: "bold" }]),
          text(" and "),
          text("italic", [{ type: "italic" }]),
          text("."),
        ],
      },
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

describe("documentXml", () => {
  it("emits a w:document root with a body", () => {
    const xml = documentXml(sampleDoc());
    expect(xml).toContain("<w:document");
    expect(xml).toContain("<w:body>");
    expect(xml).toContain("<w:sectPr/>");
  });

  it("maps a heading to a styled paragraph", () => {
    const xml = documentXml(sampleDoc());
    expect(xml).toContain('<w:pStyle w:val="Heading1"/>');
    expect(xml).toContain("Title");
  });

  it("maps bold and italic marks to run properties", () => {
    const xml = documentXml(sampleDoc());
    expect(xml).toContain("<w:b/>");
    expect(xml).toContain("<w:i/>");
  });

  it("escapes XML-special characters in text", () => {
    const doc: DocumentJSON = {
      type: "doc",
      content: [
        { type: "paragraph", content: [text("a < b & c > d")] },
      ],
    };
    const xml = documentXml(doc);
    expect(xml).toContain("a &lt; b &amp; c &gt; d");
  });

  it("preserves nested list content", () => {
    const doc: DocumentJSON = {
      type: "doc",
      content: [
        {
          type: "bullet_list",
          content: [
            {
              type: "list_item",
              content: [
                { type: "paragraph", content: [text("Outer")] },
                {
                  type: "bullet_list",
                  content: [
                    {
                      type: "list_item",
                      content: [
                        { type: "paragraph", content: [text("Inner")] },
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
    const xml = documentXml(doc);
    expect(xml).toContain("Outer");
    expect(xml).toContain("Inner");
  });

  it("renders a table as w:tbl with rows and cells", () => {
    const doc: DocumentJSON = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "table_row",
              content: [
                {
                  type: "table_cell",
                  content: [
                    { type: "paragraph", content: [text("A")] },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const xml = documentXml(doc);
    expect(xml).toContain("<w:tbl>");
    expect(xml).toContain("<w:tr>");
    expect(xml).toContain("<w:tc>");
  });
});

describe("exportDocx", () => {
  it("produces a zip with the required OOXML parts", async () => {
    const bytes = await exportDocx(sampleDoc());
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);

    const zip = await JSZip.loadAsync(bytes);
    expect(zip.file("[Content_Types].xml")).not.toBeNull();
    expect(zip.file("_rels/.rels")).not.toBeNull();
    expect(zip.file("word/document.xml")).not.toBeNull();
    expect(zip.file("word/styles.xml")).not.toBeNull();
  });

  it("round-trips the document body through the zip", async () => {
    const bytes = await exportDocx(sampleDoc());
    const zip = await JSZip.loadAsync(bytes);
    const body = await zip.file("word/document.xml")!.async("string");
    expect(body).toContain("Title");
    expect(body).toContain("<w:b/>");
  });
});
