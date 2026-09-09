/**
 * Tests for the inline markdown input rules (**bold**, *italic*,
 * ~~strike~~, `code`). These run headlessly: a rule's handler is driven
 * the same way the editor's input-rule engine does — matching the regex
 * against the block text up to the caret, then invoking the handler.
 */

import { describe, it, expect } from "vitest";
import { createEditor, type Extension, type EditorInstance } from "@smeditor/core";
import { MarkdownExtension } from "../src/index.js";

// A tiny extension registering just the marks the inline rules target,
// so the test doesn't depend on the individual mark packages.
const inlineMarks: Extension = {
  name: "test_marks",
  marks: [
    { name: "bold", toDOM: () => ["strong", 0], parseDOM: [{ tag: "strong" }] },
    { name: "italic", toDOM: () => ["em", 0], parseDOM: [{ tag: "em" }] },
    { name: "strike", toDOM: () => ["s", 0], parseDOM: [{ tag: "s" }] },
    { name: "code", toDOM: () => ["code", 0], parseDOM: [{ tag: "code" }] },
  ],
};

function editorWith(text: string, withMarks = true): EditorInstance {
  const editor = createEditor({
    content: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text }] }],
    },
    extensions: withMarks ? [inlineMarks, MarkdownExtension] : [MarkdownExtension],
  });
  editor.setSelection({
    anchor: { path: [0], offset: text.length },
    head: { path: [0], offset: text.length },
  });
  return editor;
}

/** Mirror the editor's applyInputRules: run rules against text-before-caret. */
function runRules(editor: EditorInstance): boolean {
  const sel = editor.getSelection();
  if (!sel) return false;
  const before = (editor.getJSON().content[0].content ?? [])
    .map((n) => n.text ?? "")
    .join("")
    .slice(0, sel.anchor.offset);
  for (const rule of MarkdownExtension.inputRules ?? []) {
    rule.match.lastIndex = 0;
    const m = rule.match.exec(before);
    if (m && rule.handler(editor, m)) return true;
  }
  return false;
}

const firstChild = (editor: EditorInstance) =>
  editor.getJSON().content[0].content?.[0];

describe("inline markdown input rules", () => {
  it("turns **text** into bold and drops the delimiters", () => {
    const editor = editorWith("**bold**");
    expect(runRules(editor)).toBe(true);
    const node = firstChild(editor);
    expect(node?.text).toBe("bold");
    expect(node?.marks?.[0].type).toBe("bold");
    expect(editor.getSelection()?.anchor.offset).toBe(4);
  });

  it("turns *text* into italic without matching **bold**", () => {
    const editor = editorWith("*it*");
    expect(runRules(editor)).toBe(true);
    const node = firstChild(editor);
    expect(node?.text).toBe("it");
    expect(node?.marks?.[0].type).toBe("italic");
  });

  it("turns ~~text~~ into strike", () => {
    const editor = editorWith("~~no~~");
    expect(runRules(editor)).toBe(true);
    expect(firstChild(editor)?.marks?.[0].type).toBe("strike");
  });

  it("turns `text` into code", () => {
    const editor = editorWith("`x`");
    expect(runRules(editor)).toBe(true);
    expect(firstChild(editor)?.marks?.[0].type).toBe("code");
  });

  it("does not match a half-typed bold span", () => {
    const editor = editorWith("**bold*");
    expect(runRules(editor)).toBe(false);
    expect(firstChild(editor)?.text).toBe("**bold*");
  });

  it("is a no-op when the mark is not in the schema", () => {
    const editor = editorWith("**bold**", /* withMarks */ false);
    expect(runRules(editor)).toBe(false);
    expect(firstChild(editor)?.text).toBe("**bold**");
    expect(firstChild(editor)?.marks).toBeUndefined();
  });
});
