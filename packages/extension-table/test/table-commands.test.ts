import { describe, it, expect } from "vitest";
import { createEditor, type DocumentJSON } from "@smeditor/core";
import { TableExtension } from "../src/index.js";

function tableDoc(): DocumentJSON {
  const cell = (text: string) => ({
    type: "table_cell",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text }],
      },
    ],
  });

  return {
    type: "doc",
    content: [
      {
        type: "table",
        content: [
          { type: "table_row", content: [cell("A"), cell("B")] },
          { type: "table_row", content: [cell("C"), cell("D")] },
        ],
      },
    ],
  };
}

describe("table commands", () => {
  it("sets cell background and alignment on the active cell", () => {
    const editor = createEditor({
      content: tableDoc(),
      extensions: [TableExtension],
      deepSelection: true,
    });

    editor.setSelection({
      anchor: { path: [0, 0, 0, 0], offset: 0 },
      head: { path: [0, 0, 0, 0], offset: 0 },
    });

    expect(editor.commands.setCellBackground?.({ color: "#ffeeaa" })).toBe(true);
    expect(editor.commands.setCellAlign?.({ align: "center" })).toBe(true);

    const cell = editor.getJSON().content[0].content?.[0].content?.[0];
    expect(cell?.attrs?.backgroundColor).toBe("#ffeeaa");
    expect(cell?.attrs?.textAlign).toBe("center");

    const html = editor.getHTML();
    expect(html).toContain("background-color: #ffeeaa");
    expect(html).toContain("text-align: center");

    editor.setContent(html);
    const parsedCell = editor.getJSON().content[0].content?.[0].content?.[0];
    expect(parsedCell?.attrs?.backgroundColor).toBe("#ffeeaa");
    expect(parsedCell?.attrs?.textAlign).toBe("center");
  });

  it("does not fabricate colwidth from min-width / max-width", () => {
    const editor = createEditor({
      content: tableDoc(),
      extensions: [TableExtension],
      deepSelection: true,
    });

    editor.setContent(
      '<table><tr><td style="min-width: 50px">x</td></tr></table>',
    );
    const cell = editor.getJSON().content[0].content?.[0].content?.[0];
    expect(cell?.attrs?.colwidth ?? null).toBe(null);

    // A standalone width declaration is still parsed.
    editor.setContent(
      '<table><tr><td style="width: 80px">x</td></tr></table>',
    );
    const widthCell = editor.getJSON().content[0].content?.[0].content?.[0];
    expect(widthCell?.attrs?.colwidth).toBe(80);
  });

  it("toggles the active visual column between td and th", () => {
    const editor = createEditor({
      content: tableDoc(),
      extensions: [TableExtension],
      deepSelection: true,
    });

    editor.setSelection({
      anchor: { path: [0, 0, 1, 0], offset: 0 },
      head: { path: [0, 0, 1, 0], offset: 0 },
    });

    expect(editor.commands.toggleHeaderColumn?.()).toBe(true);
    let rows = editor.getJSON().content[0].content ?? [];
    expect(rows[0].content?.[1].attrs?.header).toBe(true);
    expect(rows[1].content?.[1].attrs?.header).toBe(true);
    expect(editor.getHTML()).toContain("<th>");

    expect(editor.commands.toggleHeaderColumn?.()).toBe(true);
    rows = editor.getJSON().content[0].content ?? [];
    expect(rows[0].content?.[1].attrs?.header).toBeUndefined();
    expect(rows[1].content?.[1].attrs?.header).toBeUndefined();
  });

  it("sets a row height and round-trips it through HTML", () => {
    const editor = createEditor({
      content: tableDoc(),
      extensions: [TableExtension],
      deepSelection: true,
    });

    expect(
      editor.commands.setRowHeight?.({ tableIndex: 0, row: 1, height: 48 }),
    ).toBe(true);
    expect(editor.getJSON().content[0].content?.[1].attrs?.rowheight).toBe(48);
    const html = editor.getHTML();
    expect(html).toContain("height: 48px");

    editor.setContent(html);
    expect(editor.getJSON().content[0].content?.[1].attrs?.rowheight).toBe(48);

    // Out-of-range heights are rejected.
    expect(
      editor.commands.setRowHeight?.({ tableIndex: 0, row: 0, height: 99999 }),
    ).toBe(false);
  });
});
