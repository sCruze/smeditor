/**
 * The colour tools: text colour, fill (area behind the text with a
 * readable text colour) and underline colour.
 */

import { describe, expect, it } from "vitest";
import { contrastTextColor, createEditor } from "@smeditor/core";
import type { DocumentNode } from "@smeditor/core";
import { FullKit } from "../src/index.js";

function selection(from: number, to: number) {
  return { anchor: { path: [0], offset: from }, head: { path: [0], offset: to } };
}

function editorWith(html: string) {
  return createEditor({ content: html, extensions: [FullKit] });
}

function marksOf(editor: ReturnType<typeof createEditor>) {
  return (editor.getJSON().content[0].content ?? []).map((node: DocumentNode) => ({
    text: node.text,
    marks: (node.marks ?? []).map((m) => m.type),
  }));
}

describe("contrastTextColor", () => {
  it("picks white on dark fills and dark text on light ones", () => {
    expect(contrastTextColor("#1a1a1f")).toBe("#ffffff");
    expect(contrastTextColor("#ef4444")).toBe("#ffffff");
    expect(contrastTextColor("#fef08a")).toBe("#1a1a1f");
    expect(contrastTextColor("rgb(255, 255, 255)")).toBe("#1a1a1f");
  });
});

describe("fill", () => {
  it("paints the area and makes the text readable on it", () => {
    const editor = editorWith("<p>fill me</p>");
    editor.setSelection(selection(0, 4));
    expect(editor.commands.setBackgroundColor?.({ color: "#ef4444" })).toBe(true);
    expect(editor.getHTML()).toBe(
      '<p><span class="smeditor-fill" style="background-color: #ef4444; color: #ffffff">fill</span> me</p>',
    );
    expect(editor.getMarkAttributes("background_color")).toEqual({ color: "#ef4444", textColor: "#ffffff" });
  });

  it("uses dark text on a light fill and honours an explicit text colour", () => {
    const editor = editorWith("<p>word</p>");
    editor.setSelection(selection(0, 4));
    editor.commands.setBackgroundColor?.({ color: "#fef08a" });
    expect(editor.getHTML()).toContain("background-color: #fef08a; color: #1a1a1f");
    editor.commands.setBackgroundColor?.({ color: "#fef08a", textColor: "#ffffff" });
    expect(editor.getHTML()).toContain("background-color: #fef08a; color: #ffffff");
  });

  it("replaces the text colour and highlight on the filled range", () => {
    const editor = editorWith('<p><span style="color: #ef4444"><mark style="background-color: #fef08a">word</mark></span></p>');
    editor.setSelection(selection(0, 4));
    editor.commands.setBackgroundColor?.({ color: "#ef4444" });
    expect(marksOf(editor)).toEqual([{ text: "word", marks: ["background_color"] }]);
  });

  it("lets a text colour applied afterwards win inside the fill", () => {
    const editor = editorWith("<p>word</p>");
    editor.setSelection(selection(0, 4));
    editor.commands.setBackgroundColor?.({ color: "#1a1a1f" });
    editor.commands.setTextColor?.({ color: "#fef08a" });
    expect(editor.getHTML()).toBe(
      '<p><span class="smeditor-fill" style="background-color: #1a1a1f; color: #ffffff"><span style="color: #fef08a">word</span></span></p>',
    );
  });

  it("round-trips as one fill mark, without an extra text colour", () => {
    const html = '<p><span class="smeditor-fill" style="background-color: #22c55e; color: #1a1a1f">ok</span></p>';
    const editor = editorWith(html);
    expect(marksOf(editor)).toEqual([{ text: "ok", marks: ["background_color"] }]);
    expect(editor.getHTML()).toBe(html);
  });

  it("reads plain background spans and the 0.3.2 outline class as fills", () => {
    const plain = editorWith('<p><span style="background-color: #1a1a1f">a</span></p>');
    expect(plain.getHTML()).toContain("background-color: #1a1a1f; color: #ffffff");
    const outline = editorWith('<p><span class="smeditor-text-outline" style="background-color: #fef08a; color: #ef4444">b</span></p>');
    expect(marksOf(outline)).toEqual([{ text: "b", marks: ["background_color"] }]);
    expect(outline.getMarkAttributes("background_color")).toBeNull();
    outline.setSelection(selection(0, 1));
    expect(outline.getMarkAttributes("background_color")).toEqual({ color: "#fef08a", textColor: "#ef4444" });
  });
});

describe("highlight", () => {
  it("keeps the text readable on a dark highlight", () => {
    const editor = editorWith("<p>word</p>");
    editor.setSelection(selection(0, 4));
    editor.commands.setHighlight?.({ color: "#1a1a1f" });
    expect(editor.getHTML()).toBe('<p><mark style="background-color: #1a1a1f; color: #ffffff">word</mark></p>');
  });

  it("replaces the text colour on its range and round-trips as one mark", () => {
    const editor = editorWith('<p><span style="color: #ef4444">word</span></p>');
    editor.setSelection(selection(0, 4));
    editor.commands.setHighlight?.({ color: "#ef4444" });
    expect(marksOf(editor)).toEqual([{ text: "word", marks: ["highlight"] }]);
    const html = editor.getHTML();
    expect(marksOf(editorWith(html))).toEqual([{ text: "word", marks: ["highlight"] }]);
    expect(editorWith(html).getHTML()).toBe(html);
  });

  it("reads older highlights without a text colour and adds a readable one", () => {
    const editor = editorWith('<p><mark style="background-color: #ef4444">old</mark></p>');
    expect(editor.getHTML()).toContain("background-color: #ef4444; color: #ffffff");
  });
});

describe("underline colour", () => {
  it("underlines the selection in the chosen colour and round-trips", () => {
    const editor = editorWith("<p>line here</p>");
    editor.setSelection(selection(0, 4));
    expect(editor.commands.setUnderlineColor?.({ color: "#3b82f6" })).toBe(true);
    const html = editor.getHTML();
    expect(html).toBe('<p><u style="text-decoration-color: #3b82f6">line</u> here</p>');
    expect(editorWith(html).getHTML()).toBe(html);
    expect(editor.isActive("underline")).toBe(true);
  });

  it("drops only the colour with unsetUnderlineColor, keeping the underline", () => {
    const editor = editorWith('<p><u style="text-decoration-color: #3b82f6">line</u></p>');
    editor.setSelection(selection(0, 4));
    expect(editor.commands.unsetUnderlineColor?.()).toBe(true);
    expect(editor.getHTML()).toBe("<p><u>line</u></p>");
  });

  it("renders the underline inside the text colour so the line matches the text", () => {
    const editor = editorWith("<p>word</p>");
    editor.setSelection(selection(0, 4));
    editor.commands.toggleUnderline?.();
    editor.commands.setTextColor?.({ color: "#22c55e" });
    expect(editor.getHTML()).toBe('<p><span style="color: #22c55e"><u>word</u></span></p>');
  });
});
