import { describe, expect, it } from "vitest";
import { createEditor } from "@smeditor/core";
import { StarterKit } from "@smeditor/starter-kit";
import { FullKit } from "../src/index.js";

describe("MVP smoke", () => {
  it("supports the documented StarterKit working path", () => {
    const updates: Array<{ html: string; jsonType: string }> = [];
    const editor = createEditor({
      extensions: [StarterKit],
      content: "<p>Hello <a href=\"https://example.com\">link</a></p>",
      onUpdate: ({ html, json }) => {
        updates.push({ html, jsonType: json.type });
      },
    });

    expect(editor.getHTML()).toContain("https://example.com");
    editor.setSelection({
      anchor: { path: [0], offset: 0 },
      head: { path: [0], offset: 5 },
    });
    expect(editor.commands.toggleBold?.()).toBe(true);
    expect(editor.commands.insertTable?.({ rows: 2, cols: 2 })).toBe(true);
    expect(editor.commands.undo?.()).toBe(true);
    expect(editor.commands.redo?.()).toBe(true);
    expect(editor.getJSON().type).toBe("doc");
    expect(updates[updates.length - 1]?.jsonType).toBe("doc");
  });

  it("keeps FullKit rich formatting through HTML reload", () => {
    const editor = createEditor({
      extensions: [FullKit],
      content:
        '<p><strong><span style="color: #ef4444; background-color: #fef08a">Rich</span></strong></p>',
    });

    const html = editor.getHTML();
    editor.setContent(html);

    expect(editor.getHTML()).toContain("<strong>");
    expect(editor.getHTML()).toContain("color: #ef4444");
    expect(editor.getHTML()).toContain("background-color: #fef08a");
  });
});
