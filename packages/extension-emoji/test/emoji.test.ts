/**
 * Tests for the emoji extension: the `:shortcode:` input rule and the
 * `insertEmoji` command. These run headlessly: the rule's handler is
 * driven the same way the editor's input-rule engine does — matching
 * the regex against the block text up to the caret, then invoking the
 * handler.
 */

import { describe, it, expect } from "vitest";
import {
  createEditor,
  type EditorInstance,
} from "@smeditor/core";
import { EmojiExtension, EMOJI, emojiForShortcode } from "../src/index.js";

function editorWith(text: string): EditorInstance {
  const editor = createEditor({
    content: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text }] }],
    },
    extensions: [EmojiExtension],
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
  for (const rule of EmojiExtension.inputRules ?? []) {
    rule.match.lastIndex = 0;
    const m = rule.match.exec(before);
    if (m && rule.handler(editor, m)) return true;
  }
  return false;
}

const firstChild = (editor: EditorInstance) =>
  editor.getJSON().content[0].content?.[0];

describe("emoji map", () => {
  it("exposes ~60 shortcodes including the documented ones", () => {
    expect(Object.keys(EMOJI).length).toBeGreaterThanOrEqual(60);
    expect(EMOJI.fire).toBe("🔥");
    expect(EMOJI.check).toBe("✅");
    expect(EMOJI.thumbsup).toBe("👍");
  });

  it("emojiForShortcode resolves names case-insensitively", () => {
    expect(emojiForShortcode("fire")).toBe("🔥");
    expect(emojiForShortcode("FIRE")).toBe("🔥");
    expect(emojiForShortcode("nope")).toBe(null);
    expect(emojiForShortcode("")).toBe(null);
  });
});

describe("emoji input rule", () => {
  it("replaces :fire: with the emoji", () => {
    const editor = editorWith(":fire:");
    expect(runRules(editor)).toBe(true);
    const node = firstChild(editor);
    expect(node?.text).toBe("🔥");
    expect(editor.getSelection()?.anchor.offset).toBe("🔥".length);
  });

  it("replaces :smile: mid-text leaving surrounding text intact", () => {
    const editor = editorWith("hi :smile:");
    expect(runRules(editor)).toBe(true);
    const text = (editor.getJSON().content[0].content ?? [])
      .map((n) => n.text ?? "")
      .join("");
    expect(text).toBe("hi 😄");
  });

  it("leaves an unknown :nope: literal (rule returns false)", () => {
    const editor = editorWith(":nope:");
    expect(runRules(editor)).toBe(false);
    expect(firstChild(editor)?.text).toBe(":nope:");
  });
});

describe("insertEmoji command", () => {
  it("inserts the emoji for a known shortcode", () => {
    const editor = editorWith("");
    expect(editor.commands.insertEmoji?.("fire")).toBe(true);
    expect(firstChild(editor)?.text).toBe("🔥");
  });

  it("accepts the object form { name }", () => {
    const editor = editorWith("");
    expect(editor.commands.insertEmoji?.({ name: "tada" })).toBe(true);
    expect(firstChild(editor)?.text).toBe("🎉");
  });

  it("accepts a raw emoji char passed directly", () => {
    const editor = editorWith("");
    expect(editor.commands.insertEmoji?.("🚀")).toBe(true);
    expect(firstChild(editor)?.text).toBe("🚀");
  });

  it("returns false for an unknown shortcode", () => {
    const editor = editorWith("");
    expect(editor.commands.insertEmoji?.("definitely_not_a_shortcode")).toBe(
      false,
    );
  });
});
