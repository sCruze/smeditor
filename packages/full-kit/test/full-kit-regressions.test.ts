import { describe, expect, it } from "vitest";
import { createEditor } from "@smeditor/core";
import type { DocumentJSON, DocumentNode, Mark } from "@smeditor/core";
import { FullKit } from "../src/index.js";

function selection(from: number, to: number) {
  return {
    anchor: { path: [0], offset: from },
    head: { path: [0], offset: to },
  };
}

function collectMarks(node: DocumentNode): Mark[] {
  const ownMarks = node.marks ?? [];
  const childMarks = (node.content ?? []).flatMap((child) => collectMarks(child));
  return [...ownMarks, ...childMarks];
}

function marksIn(doc: DocumentJSON): Mark[] {
  return doc.content.flatMap((node) => collectMarks(node));
}

describe("FullKit MVP regressions", () => {
  it("creates tables through the bundled insertTable command", () => {
    const editor = createEditor({ extensions: [FullKit] });

    expect(editor.commands.insertTable?.({ rows: 2, cols: 2 })).toBe(true);

    const table = editor.getJSON().content[0];
    expect(table.type).toBe("table");
    expect(table.content).toHaveLength(2);
    expect(table.content?.[0].content).toHaveLength(2);
  });

  it("applies text color, background, highlight, and text stroke to selected text", () => {
    const editor = createEditor({
      content: "<p>Styled text</p>",
      extensions: [FullKit],
    });
    editor.setSelection(selection(0, 6));

    expect(editor.commands.setTextColor?.({ color: "#ef4444" })).toBe(true);
    expect(editor.commands.setBackgroundColor?.({ color: "#ddd6fe" })).toBe(true);
    expect(editor.commands.setHighlight?.({ color: "#fef08a" })).toBe(true);
    expect(
      editor.commands.setTextStroke?.({ color: "#111827", width: "1px" }),
    ).toBe(true);

    const marks = marksIn(editor.getJSON());
    expect(marks.some((mark) => mark.type === "text_color")).toBe(true);
    expect(marks.some((mark) => mark.type === "background_color")).toBe(true);
    expect(marks.some((mark) => mark.type === "highlight")).toBe(true);
    expect(marks.some((mark) => mark.type === "text_stroke")).toBe(true);
  });

  it("keeps centered content inside blockquote after HTML round-trip", () => {
    const editor = createEditor({
      content: "<p>Quote</p>",
      extensions: [FullKit],
      deepSelection: true,
    });

    expect(editor.commands.toggleBlockquote?.()).toBe(true);
    editor.setSelection({
      anchor: { path: [0, 0], offset: 0 },
      head: { path: [0, 0], offset: 0 },
    });
    expect(editor.commands.setTextAlign?.({ align: "center" })).toBe(true);

    const html = editor.getHTML();
    expect(html).toContain("<blockquote>");
    expect(html).toContain("text-align: center");

    editor.setContent(html);
    const paragraph = editor.getJSON().content[0].content?.[0];
    expect(paragraph?.attrs?.textAlign).toBe("center");
  });

  it("preserves rich marks through HTML to JSON to HTML reloads", () => {
    const html = `
<p><strong><span style="color: #ef4444; background-color: #ddd6fe; -webkit-text-stroke: 1px #111827">Rich</span></strong> <mark style="background-color: #fef08a">mark</mark></p>
`;
    const editor = createEditor({ content: html, extensions: [FullKit] });
    const firstPass = editor.getHTML();

    editor.setContent(firstPass);

    const secondPass = editor.getHTML();
    expect(secondPass).toContain("<strong>");
    expect(secondPass).toContain("color: #ef4444");
    expect(secondPass).toContain("background-color: #ddd6fe");
    expect(secondPass).toContain("-webkit-text-stroke: 1px #111827");
    expect(secondPass).toContain("<mark");
  });
});
