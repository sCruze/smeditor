import { describe, expect, it } from "vitest";
import { createEditor } from "@smeditor/core";
import { EmbedExtension, normalizeEmbedSrc } from "../src/index.js";

describe("embed extension", () => {
  it("inserts a YouTube watch URL and normalises it to the embed form", () => {
    const editor = createEditor({ extensions: [EmbedExtension] });

    expect(
      editor.commands.insertEmbed?.({
        src: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      }),
    ).toBe(true);

    const embed = editor.getJSON().content[0];
    expect(embed.type).toBe("embed");
    expect(embed.attrs?.src).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    );

    const html = editor.getHTML();
    expect(html).toContain("<iframe");
    expect(html).toContain("youtube.com/embed/dQw4w9WgXcQ");
    expect(html).toContain('sandbox="allow-scripts allow-same-origin allow-presentation"');
    expect(html).toContain("allowfullscreen");
  });

  it("normalises youtu.be short URLs and vimeo URLs", () => {
    expect(normalizeEmbedSrc("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    );
    expect(
      normalizeEmbedSrc("https://www.youtube.com/embed/dQw4w9WgXcQ"),
    ).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
    expect(normalizeEmbedSrc("https://vimeo.com/123456789")).toBe(
      "https://player.vimeo.com/video/123456789",
    );
    expect(
      normalizeEmbedSrc("https://player.vimeo.com/video/123456789"),
    ).toBe("https://player.vimeo.com/video/123456789");
  });

  it("custom dimensions round-trip through JSON and HTML", () => {
    const editor = createEditor({ extensions: [EmbedExtension] });

    expect(
      editor.commands.insertEmbed?.({
        src: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        width: 800,
        height: 450,
      }),
    ).toBe(true);

    const embed = editor.getJSON().content[0];
    expect(embed.attrs?.width).toBe(800);
    expect(embed.attrs?.height).toBe(450);

    const html = editor.getHTML();
    expect(html).toContain('width="800"');
    expect(html).toContain('height="450"');
  });

  it("insertYoutube is an alias for insertEmbed", () => {
    const editor = createEditor({ extensions: [EmbedExtension] });

    expect(
      editor.commands.insertYoutube?.({
        src: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      }),
    ).toBe(true);

    const embed = editor.getJSON().content[0];
    expect(embed.type).toBe("embed");
    expect(embed.attrs?.src).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    );
  });

  it("rejects unsafe and non-allowlisted embed sources", () => {
    const editor = createEditor({ extensions: [EmbedExtension] });

    expect(
      editor.commands.insertEmbed?.({ src: "javascript:alert(1)" }),
    ).toBe(false);
    expect(
      editor.commands.insertEmbed?.({ src: "https://evil.example.com/x" }),
    ).toBe(false);
    expect(
      editor.commands.insertEmbed?.({
        src: "http://www.youtube.com/watch?v=dQw4w9WgXcQ",
      }),
    ).toBe(false);
    expect(
      editor.commands.insertEmbed?.({ src: "data:text/html;base64,AAAA" }),
    ).toBe(false);

    // Nothing was inserted — the doc is still its initial empty paragraph.
    expect(editor.getJSON().content[0].type).toBe("paragraph");
    expect(
      editor.getJSON().content.some((n) => n.type === "embed"),
    ).toBe(false);
  });

  it("normalizeEmbedSrc returns null for unsafe inputs", () => {
    expect(normalizeEmbedSrc("javascript:alert(1)")).toBeNull();
    expect(normalizeEmbedSrc("https://evil.example.com/")).toBeNull();
    expect(normalizeEmbedSrc("http://www.youtube.com/embed/abcdef")).toBeNull();
    expect(normalizeEmbedSrc(null)).toBeNull();
    expect(normalizeEmbedSrc("")).toBeNull();
    expect(normalizeEmbedSrc("https://www.youtube.com/watch?v=%3Cscript%3E")).toBeNull();
  });

  it("parses a safe iframe from HTML and drops unsafe iframes", () => {
    const editor = createEditor({ extensions: [EmbedExtension] });

    editor.setContent(
      '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>',
    );
    const parsed = editor.getJSON().content.find((n) => n.type === "embed");
    expect(parsed).toBeDefined();
    expect(parsed?.attrs?.src).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    );

    // An unsafe iframe src must not produce an embed node.
    editor.setContent('<iframe src="https://evil.example.com/x"></iframe>');
    expect(
      editor.getJSON().content.some((n) => n.type === "embed"),
    ).toBe(false);
  });

  it("round-trips an embed through getHTML -> setContent", () => {
    const editor = createEditor({ extensions: [EmbedExtension] });

    expect(
      editor.commands.insertEmbed?.({
        src: "https://vimeo.com/123456789",
      }),
    ).toBe(true);

    const html = editor.getHTML();
    editor.setContent(html);

    const parsed = editor.getJSON().content.find((n) => n.type === "embed");
    expect(parsed).toBeDefined();
    expect(parsed?.attrs?.src).toBe(
      "https://player.vimeo.com/video/123456789",
    );
  });
});
