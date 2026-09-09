/**
 * Tests for the autolink input rule: typing a bare URL followed by a
 * space wraps the URL — and only the URL — in a `link` mark.
 *
 * The editor's input-rule engine matches `inputRules[i].match` against
 * the block text up to the caret, then calls the rule's handler with
 * that RegExpExecArray (see core/src/editor.ts applyInputRules). These
 * tests drive that exact path manually: set content + selection, build
 * the match, then invoke the handler.
 */

import { describe, it, expect } from "vitest";
import { createEditor } from "@smeditor/core";
import type { DocumentNode, EditorInstance } from "@smeditor/core";
import { ParagraphExtension } from "@smeditor/extension-paragraph";
import { LinkExtension } from "../src/index.js";

const rule = LinkExtension.inputRules![0];

/**
 * Mirror the editor's input-rule engine: set the paragraph text with a
 * caret at the end, match the rule against the block text up to the
 * caret, and fire the handler. Returns whether the rule handled it.
 */
function typeAndFire(editor: EditorInstance, text: string): boolean {
  editor.setContent({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  });
  const offset = text.length;
  editor.setSelection({
    anchor: { path: [0], offset },
    head: { path: [0], offset },
  });
  const match = rule.match.exec(text.slice(0, offset));
  if (!match) return false;
  return rule.handler(editor, match);
}

function paragraphContent(editor: EditorInstance): DocumentNode[] {
  return editor.getJSON().content[0].content ?? [];
}

function linkNode(content: DocumentNode[]): DocumentNode | undefined {
  return content.find((n) => n.marks?.some((m) => m.type === "link"));
}

describe("autolink input rule", () => {
  it("links a bare URL typed at the end of a paragraph", () => {
    const editor = createEditor({
      extensions: [ParagraphExtension, LinkExtension],
    });

    expect(typeAndFire(editor, "see https://example.com ")).toBe(true);

    const content = paragraphContent(editor);
    const linked = linkNode(content);
    expect(linked).toBeDefined();
    expect(linked?.text).toBe("https://example.com");
    expect(linked?.marks?.find((m) => m.type === "link")?.attrs?.href).toBe(
      "https://example.com",
    );

    // The visible text is unchanged, and the trailing space must NOT
    // carry the link mark.
    const full = content.map((n) => n.text).join("");
    expect(full).toBe("see https://example.com ");
    const last = content[content.length - 1];
    expect(last.text).toBe(" ");
    expect(last.marks?.some((m) => m.type === "link") ?? false).toBe(false);
  });

  it("links a URL that begins the block", () => {
    const editor = createEditor({
      extensions: [ParagraphExtension, LinkExtension],
    });

    expect(typeAndFire(editor, "https://example.com ")).toBe(true);

    const linked = linkNode(paragraphContent(editor));
    expect(linked?.text).toBe("https://example.com");
    expect(linked?.marks?.find((m) => m.type === "link")?.attrs?.href).toBe(
      "https://example.com",
    );
  });

  it("normalizes a www. URL to an https href", () => {
    const editor = createEditor({
      extensions: [ParagraphExtension, LinkExtension],
    });

    expect(typeAndFire(editor, "go www.example.com ")).toBe(true);

    const linked = linkNode(paragraphContent(editor));
    expect(linked?.text).toBe("www.example.com");
    expect(linked?.marks?.find((m) => m.type === "link")?.attrs?.href).toBe(
      "https://www.example.com",
    );
  });

  it("does nothing for plain (non-URL) text followed by a space", () => {
    const editor = createEditor({
      extensions: [ParagraphExtension, LinkExtension],
    });

    expect(typeAndFire(editor, "just some words ")).toBe(false);
    expect(linkNode(paragraphContent(editor))).toBeUndefined();
  });

  it("does not link an unsafe javascript: URL", () => {
    const editor = createEditor({
      extensions: [ParagraphExtension, LinkExtension],
    });

    // The match regex only recognises http(s)/www, so this never even
    // matches — assert no rule fires and no link mark appears.
    expect(typeAndFire(editor, "javascript:alert(1) ")).toBe(false);
    expect(linkNode(paragraphContent(editor))).toBeUndefined();
  });

  it("does not re-link a URL already inside a link mark", () => {
    const editor = createEditor({
      extensions: [ParagraphExtension, LinkExtension],
    });

    const text = "https://example.com ";
    editor.setContent({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "https://example.com",
              marks: [{ type: "link", attrs: { href: "https://example.com" } }],
            },
            { type: "text", text: " " },
          ],
        },
      ],
    });
    editor.setSelection({
      anchor: { path: [0], offset: text.length },
      head: { path: [0], offset: text.length },
    });
    const match = rule.match.exec(text);
    expect(match).not.toBeNull();
    expect(rule.handler(editor, match!)).toBe(false);
  });
});
