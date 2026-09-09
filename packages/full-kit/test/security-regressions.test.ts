import { describe, expect, it } from "vitest";
import { createEditor } from "@smeditor/core";
import type { DocumentJSON } from "@smeditor/core";
import { FullKit } from "../src/index.js";

describe("FullKit security regressions", () => {
  it("does not serialize unsafe link href from JSON content", () => {
    const doc: DocumentJSON = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Bad link",
              marks: [
                {
                  type: "link",
                  attrs: { href: "javascript:alert(1)", target: "_blank" },
                },
              ],
            },
          ],
        },
      ],
    };
    const editor = createEditor({ content: doc, extensions: [FullKit] });

    expect(editor.getHTML()).not.toContain("javascript:");
    expect(editor.getHTML()).not.toContain("<a");
  });

  it("adds rel noopener noreferrer for blank links", () => {
    const editor = createEditor({ content: "<p>Link</p>", extensions: [FullKit] });
    editor.setSelection({
      anchor: { path: [0], offset: 0 },
      head: { path: [0], offset: 4 },
    });

    expect(
      editor.commands.setLink?.({ href: "https://example.com", target: "_blank" }),
    ).toBe(true);
    expect(editor.getHTML()).toContain('rel="noopener noreferrer"');
  });

  it("drops unsafe link and image URLs while parsing HTML", () => {
    const editor = createEditor({
      content:
        '<p><a href="javascript:alert(1)">link</a></p><img src="data:image/svg+xml;base64,PHN2Zz4="><img src="https://example.com/safe.png">',
      extensions: [FullKit],
    });
    const html = editor.getHTML();

    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("image/svg+xml");
    expect(html).toContain("https://example.com/safe.png");
  });

  it("drops unsafe table cell style values and keeps safe formatting", () => {
    const editor = createEditor({
      content:
        '<table><tr><td style="background-color: url(javascript:alert(1)); text-align: center">Bad</td><td style="background-color: #fef08a; text-align: right">Safe</td></tr></table>',
      extensions: [FullKit],
    });
    const html = editor.getHTML();

    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("url(");
    expect(html).toContain("background-color: #fef08a");
    expect(html).toContain("text-align: right");
  });

  it("rejects unsafe color and font style values during HTML round-trip", () => {
    const editor = createEditor({
      content:
        '<p><span style="color: red; font-family: Inter; font-size: 18px">Safe</span><span style="color: url(javascript:alert(1)); font-family: Inter; color:red">Unsafe</span></p>',
      extensions: [FullKit],
    });
    const html = editor.getHTML();

    expect(html).toContain("color: red");
    expect(html).toContain("font-family: Inter");
    expect(html).toContain("font-size: 18px");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("url(");
  });
});
