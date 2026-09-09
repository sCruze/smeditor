import { describe, it, expect } from "vitest";
import { createEditor, type DocumentJSON } from "@smeditor/core";
import { DetailsExtension, isDetailsActive } from "../src/index.js";

function paragraphDoc(text = "hello"): DocumentJSON {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text }],
      },
    ],
  };
}

function makeEditor(content: DocumentJSON = paragraphDoc()) {
  // createEditor auto-registers a fallback inline-capable paragraph, so a
  // bare DetailsExtension is enough; deepSelection lets the commands and
  // isActive walk into the details/summary nodes.
  return createEditor({
    content,
    extensions: [DetailsExtension],
    deepSelection: true,
  });
}

describe("setDetails", () => {
  it("wraps a paragraph into a details with a summary", () => {
    const editor = makeEditor();
    editor.setSelection({
      anchor: { path: [0], offset: 0 },
      head: { path: [0], offset: 0 },
    });

    expect(editor.commands.setDetails?.()).toBe(true);

    const details = editor.getJSON().content[0];
    expect(details.type).toBe("details");
    expect(details.attrs?.open).toBe(true);
    expect(details.content?.[0].type).toBe("details_summary");
    expect(details.content?.[0].content?.[0].text).toBe("Details");
    // The original paragraph survives as the body.
    expect(details.content?.[1].type).toBe("paragraph");
    expect(details.content?.[1].content?.[0].text).toBe("hello");
  });

  it("renders to <details> and <summary> HTML", () => {
    const editor = makeEditor();
    editor.setSelection({
      anchor: { path: [0], offset: 0 },
      head: { path: [0], offset: 0 },
    });
    editor.commands.setDetails?.();

    const html = editor.getHTML();
    expect(html).toContain("<details");
    expect(html).toContain("<summary");
    expect(html).toContain("Details");
  });

  it("round-trips through HTML keeping the details type", () => {
    const editor = makeEditor();
    editor.setSelection({
      anchor: { path: [0], offset: 0 },
      head: { path: [0], offset: 0 },
    });
    editor.commands.setDetails?.();

    const html = editor.getHTML();
    editor.setContent(html);

    const details = editor.getJSON().content[0];
    expect(details.type).toBe("details");
    expect(details.attrs?.open).toBe(true);
    expect(details.content?.[0].type).toBe("details_summary");
  });

  it("isDetailsActive reflects the selection", () => {
    const editor = makeEditor();
    expect(isDetailsActive(editor)).toBe(false);

    editor.setSelection({
      anchor: { path: [0], offset: 0 },
      head: { path: [0], offset: 0 },
    });
    editor.commands.setDetails?.();
    // After wrapping the caret moves into the summary, still inside details.
    expect(isDetailsActive(editor)).toBe(true);
  });
});

describe("toggleDetails", () => {
  it("wraps when outside, unwraps when inside", () => {
    const editor = makeEditor();
    editor.setSelection({
      anchor: { path: [0], offset: 0 },
      head: { path: [0], offset: 0 },
    });

    expect(editor.commands.toggleDetails?.()).toBe(true);
    expect(editor.getJSON().content[0].type).toBe("details");

    // Caret is now inside the details; toggling again unwraps it.
    expect(editor.commands.toggleDetails?.()).toBe(true);
    const after = editor.getJSON().content[0];
    expect(after.type).toBe("paragraph");
    expect(after.content?.[0].text).toBe("hello");
  });
});

describe("toggleDetailsOpen", () => {
  it("flips the open attribute on the nearest details", () => {
    const editor = makeEditor();
    editor.setSelection({
      anchor: { path: [0], offset: 0 },
      head: { path: [0], offset: 0 },
    });
    editor.commands.setDetails?.();
    expect(editor.getJSON().content[0].attrs?.open).toBe(true);

    expect(editor.commands.toggleDetailsOpen?.()).toBe(true);
    expect(editor.getJSON().content[0].attrs?.open).toBe(false);
    // The closed details drops the `open` HTML attribute.
    expect(editor.getHTML()).not.toContain("<details open");

    expect(editor.commands.toggleDetailsOpen?.()).toBe(true);
    expect(editor.getJSON().content[0].attrs?.open).toBe(true);
  });
});
