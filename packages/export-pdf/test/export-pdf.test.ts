/**
 * Tests for @smeditor/export-pdf.
 *
 * The pure `layoutDocument` is tested with a fake fixed-width text
 * measurer; `exportPdf` is checked by verifying the result is a valid
 * PDF (the %PDF- header and a non-trivial size).
 */

import { describe, it, expect } from "vitest";
import { layoutDocument, exportPdf, type MeasureText } from "../src/index.js";
import type { DocumentJSON } from "@smeditor/core";

/** Every glyph is 6 points wide — predictable wrapping. */
const fixedMeasure: MeasureText = (text) => text.length * 6;

const text = (t: string, marks?: { type: string }[]) => ({
  type: "text",
  text: t,
  ...(marks ? { marks } : {}),
});

describe("layoutDocument", () => {
  it("wraps a long paragraph to the content width", () => {
    const doc: DocumentJSON = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [text("one two three four five six seven eight")],
        },
      ],
    };
    // width 60pt -> 10 chars per line at 6pt/char
    const lines = layoutDocument(doc, { contentWidth: 60 }, fixedMeasure);
    expect(lines.length).toBeGreaterThan(1);
  });

  it("gives headings a larger font size than body text", () => {
    const doc: DocumentJSON = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [text("Title")] },
        { type: "paragraph", content: [text("Body")] },
      ],
    };
    const lines = layoutDocument(doc, { contentWidth: 400 }, fixedMeasure);
    expect(lines[0].size).toBeGreaterThan(lines[1].size);
  });

  it("indents list items and adds markers", () => {
    const doc: DocumentJSON = {
      type: "doc",
      content: [
        {
          type: "bullet_list",
          content: [
            {
              type: "list_item",
              content: [{ type: "paragraph", content: [text("item")] }],
            },
          ],
        },
      ],
    };
    const lines = layoutDocument(doc, { contentWidth: 400 }, fixedMeasure);
    expect(lines[0].indent).toBeGreaterThan(0);
    expect(lines[0].spans[0].text).toContain("\u2022");
  });

  it("carries bold styling onto the span", () => {
    const doc: DocumentJSON = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [text("bold", [{ type: "bold" }])],
        },
      ],
    };
    const lines = layoutDocument(doc, { contentWidth: 400 }, fixedMeasure);
    expect(lines[0].spans[0].bold).toBe(true);
  });

  it("preserves a hard break as a forced line", () => {
    const doc: DocumentJSON = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [text("a"), { type: "hard_break" }, text("b")],
        },
      ],
    };
    const lines = layoutDocument(doc, { contentWidth: 400 }, fixedMeasure);
    expect(lines.length).toBe(2);
  });

  it("splits embedded newlines in a code block into separate lines", () => {
    const doc: DocumentJSON = {
      type: "doc",
      content: [
        {
          type: "code_block",
          content: [text("function f() {\n  return 1;\n}")],
        },
      ],
    };
    const lines = layoutDocument(doc, { contentWidth: 400 }, fixedMeasure);
    // Three source lines -> three typeset lines, none containing "\n".
    expect(lines.length).toBe(3);
    for (const line of lines) {
      for (const span of line.spans) {
        expect(span.text).not.toContain("\n");
      }
    }
  });

  it("expands tabs to spaces and never emits a raw tab", () => {
    const doc: DocumentJSON = {
      type: "doc",
      content: [{ type: "paragraph", content: [text("a\tb")] }],
    };
    const lines = layoutDocument(doc, { contentWidth: 400 }, fixedMeasure);
    const joined = lines
      .flatMap((l) => l.spans.map((s) => s.text))
      .join("");
    expect(joined).not.toContain("\t");
    expect(joined).toContain(" ");
  });
});

describe("exportPdf", () => {
  function sampleDoc(): DocumentJSON {
    return {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [text("Report")] },
        {
          type: "paragraph",
          content: [
            text("This is "),
            text("important", [{ type: "bold" }]),
            text(" text that should wrap nicely across the page width."),
          ],
        },
      ],
    };
  }

  it("produces a valid PDF", async () => {
    const bytes = await exportPdf(sampleDoc());
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(200);
    // PDF files start with the "%PDF-" signature.
    const header = String.fromCharCode(...bytes.slice(0, 5));
    expect(header).toBe("%PDF-");
  });

  it("exports a multi-line code block without throwing", async () => {
    const doc: DocumentJSON = {
      type: "doc",
      content: [
        {
          type: "code_block",
          content: [text("function f() {\n  return 1;\n}")],
        },
      ],
    };
    const bytes = await exportPdf(doc);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(200);
  });

  it("exports text containing a tab without throwing", async () => {
    const doc: DocumentJSON = {
      type: "doc",
      content: [{ type: "paragraph", content: [text("a\tb")] }],
    };
    const bytes = await exportPdf(doc);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(200);
  });

  it("paginates a long document onto multiple pages", async () => {
    // Many paragraphs -> more than one page.
    const blocks = Array.from({ length: 120 }, (_, i) => ({
      type: "paragraph",
      content: [text(`Paragraph number ${i} with some body text.`)],
    }));
    const bytes = await exportPdf({ type: "doc", content: blocks });
    // Re-load the PDF and count its pages.
    const { PDFDocument } = await import("pdf-lib");
    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBeGreaterThan(1);
  });
});
