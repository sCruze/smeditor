import { describe, expect, it } from "vitest";
import { createEditor } from "@smeditor/core";
import { ImageExtension } from "../src/index.js";

const imageFile = new File(["image"], "photo.png", { type: "image/png" });

const tick = () => new Promise<void>((resolve) => queueMicrotask(() => resolve()));

describe("image extension", () => {
  it("round-trips image metadata through JSON and HTML", () => {
    const editor = createEditor({ extensions: [ImageExtension] });

    expect(
      editor.commands.insertImage?.({
        src: "https://example.com/photo.png",
        alt: "Photo",
        title: "Example photo",
        width: 640,
        height: 480,
        align: "right",
      }),
    ).toBe(true);

    const image = editor.getJSON().content[0];
    expect(image.type).toBe("image");
    expect(image.attrs?.src).toBe("https://example.com/photo.png");
    expect(image.attrs?.alt).toBe("Photo");
    expect(image.attrs?.title).toBe("Example photo");
    expect(image.attrs?.width).toBe(640);
    expect(image.attrs?.height).toBe(480);
    expect(image.attrs?.align).toBe("right");

    const html = editor.getHTML();
    expect(html).toContain('src="https://example.com/photo.png"');
    expect(html).toContain('alt="Photo"');
    expect(html).toContain('title="Example photo"');
    expect(html).toContain('width="640"');
    expect(html).toContain('height="480"');
    expect(html).toContain('data-align="right"');

    editor.setContent(html);
    const parsed = editor.getJSON().content[0];
    expect(parsed.attrs?.src).toBe("https://example.com/photo.png");
    expect(parsed.attrs?.width).toBe(640);
    expect(parsed.attrs?.height).toBe(480);
    expect(parsed.attrs?.align).toBe("right");
  });

  it("rejects unsafe image URLs", () => {
    const editor = createEditor({ extensions: [ImageExtension] });

    expect(editor.commands.insertImage?.({ src: "javascript:alert(1)" })).toBe(false);
    expect(
      editor.commands.insertImage?.({
        src: "data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+",
      }),
    ).toBe(false);
    expect(editor.getJSON().content[0].type).toBe("paragraph");
  });

  it("inserts image returned by configured upload handler", async () => {
    const editor = createEditor({
      extensions: [
        ImageExtension.configure?.({
          upload: async () => ({
            src: "/uploads/photo.png",
            alt: "Uploaded photo",
            width: 320,
            height: 240,
          }),
        }) ?? ImageExtension,
      ],
    });

    expect(editor.commands.uploadImage?.(imageFile)).toBe(true);
    await tick();

    const image = editor.getJSON().content[0];
    expect(image.type).toBe("image");
    expect(image.attrs?.src).toBe("/uploads/photo.png");
    expect(image.attrs?.alt).toBe("Uploaded photo");
    expect(image.attrs?.width).toBe(320);
    expect(image.attrs?.height).toBe(240);
  });
});
