/**
 * Tests for the smart typography input rules. These run headlessly: a
 * rule's handler is driven the same way the editor's input-rule engine
 * does — matching the regex against the block text up to the caret,
 * then invoking the handler. We assert the resulting text node content.
 */

import { describe, it, expect } from "vitest";
import {
  createEditor,
  type EditorInstance,
} from "@smeditor/core";
import { TypographyExtension } from "../src/index.js";

function editorWith(text: string): EditorInstance {
  const editor = createEditor({
    content: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text }] }],
    },
    extensions: [TypographyExtension],
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
  for (const rule of TypographyExtension.inputRules ?? []) {
    rule.match.lastIndex = 0;
    const m = rule.match.exec(before);
    if (m && rule.handler(editor, m)) return true;
  }
  return false;
}

/** The full visible text of the first paragraph after a rule fired. */
const blockText = (editor: EditorInstance) =>
  (editor.getJSON().content[0].content ?? [])
    .map((n) => n.text ?? "")
    .join("");

describe("smart typography input rules", () => {
  it("turns ... into an ellipsis", () => {
    const editor = editorWith("wait...");
    expect(runRules(editor)).toBe(true);
    expect(blockText(editor)).toBe("wait…");
  });

  it("turns --- into an em dash and -- into an en dash (order matters)", () => {
    const em = editorWith("a---");
    expect(runRules(em)).toBe(true);
    expect(blockText(em)).toBe("a—");

    const en = editorWith("a--");
    expect(runRules(en)).toBe(true);
    expect(blockText(en)).toBe("a–");
  });

  it("turns ASCII arrows into arrow glyphs", () => {
    const right = editorWith("a->");
    expect(runRules(right)).toBe(true);
    expect(blockText(right)).toBe("a→");

    const left = editorWith("a<-");
    expect(runRules(left)).toBe(true);
    expect(blockText(left)).toBe("a←");

    const both = editorWith("a<->");
    expect(runRules(both)).toBe(true);
    expect(blockText(both)).toBe("a↔");

    const dbl = editorWith("a=>");
    expect(runRules(dbl)).toBe(true);
    expect(blockText(dbl)).toBe("a⇒");
  });

  it("turns (c), (tm) and (r) into symbols", () => {
    const c = editorWith("foo(c)");
    expect(runRules(c)).toBe(true);
    expect(blockText(c)).toBe("foo©");

    const tm = editorWith("foo(tm)");
    expect(runRules(tm)).toBe(true);
    expect(blockText(tm)).toBe("foo™");

    const r = editorWith("foo(r)");
    expect(runRules(r)).toBe(true);
    expect(blockText(r)).toBe("foo®");
  });

  it("turns a standalone fraction into a glyph", () => {
    const editor = editorWith("about 1/2");
    expect(runRules(editor)).toBe(true);
    expect(blockText(editor)).toBe("about ½");
  });

  it("does not rewrite a fraction that is part of a longer number", () => {
    const editor = editorWith("21/2");
    expect(runRules(editor)).toBe(false);
    expect(blockText(editor)).toBe("21/2");
  });

  it("turns math/comparison operators into glyphs", () => {
    const ne = editorWith("a!=");
    expect(runRules(ne)).toBe(true);
    expect(blockText(ne)).toBe("a≠");

    const pm = editorWith("a+-");
    expect(runRules(pm)).toBe(true);
    expect(blockText(pm)).toBe("a±");
  });

  it("opens a double quote at start / after whitespace", () => {
    const start = editorWith('"');
    expect(runRules(start)).toBe(true);
    expect(blockText(start)).toBe("“");

    const afterSpace = editorWith('he said "');
    expect(runRules(afterSpace)).toBe(true);
    expect(blockText(afterSpace)).toBe("he said “");
  });

  it("closes a double quote after a word", () => {
    const editor = editorWith('“hello"');
    expect(runRules(editor)).toBe(true);
    expect(blockText(editor)).toBe("“hello”");
  });

  it("opens a single quote at start / after whitespace", () => {
    const start = editorWith("'");
    expect(runRules(start)).toBe(true);
    expect(blockText(start)).toBe("‘");

    const afterSpace = editorWith("she said '");
    expect(runRules(afterSpace)).toBe(true);
    expect(blockText(afterSpace)).toBe("she said ‘");
  });

  it("uses an apostrophe (closing single quote) mid-word", () => {
    const editor = editorWith("don'");
    expect(runRules(editor)).toBe(true);
    expect(blockText(editor)).toBe("don’");
  });
});
