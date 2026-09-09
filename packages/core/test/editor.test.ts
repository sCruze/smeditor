/**
 * Headless smoke tests for the core editor.
 *
 * These do not exercise the DOM-mount path — that requires jsdom and
 * is covered in a separate suite. The goal here is to verify the
 * JSON model, schema compilation, and serializer round-tripping.
 */

import { describe, it, expect } from "vitest";
import { createEditor } from "../src/index.js";
import type { Extension } from "../src/index.js";

const BoldMarkExt: Extension = {
  name: "bold",
  marks: [
    {
      name: "bold",
      toDOM: () => ["strong", 0],
      parseDOM: [{ tag: "strong" }, { tag: "b" }],
    },
  ],
  commands: {
    toggleBold:
      () =>
      (_editor) => {
        // smoke command — full toggle is covered by extension package tests
        return true;
      },
  },
};

describe("createEditor (headless)", () => {
  it("starts with an empty paragraph by default", () => {
    const editor = createEditor({ extensions: [] });
    expect(editor.getJSON()).toEqual({
      type: "doc",
      content: [{ type: "paragraph", content: [] }],
    });
  });

  it("normalizes string content as HTML", () => {
    const editor = createEditor({
      content: "<p>Hello</p>",
      extensions: [],
    });
    const json = editor.getJSON();
    expect(json.type).toBe("doc");
    expect(json.content[0].type).toBe("paragraph");
  });

  it("accepts JSON content directly", () => {
    const editor = createEditor({
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Hi" }],
          },
        ],
      },
      extensions: [],
    });
    expect(editor.getHTML()).toBe("<p>Hi</p>");
  });

  it("exposes built-in commands", () => {
    const editor = createEditor({ extensions: [] });
    expect(typeof editor.commands.setContent).toBe("function");
    expect(typeof editor.commands.clearContent).toBe("function");
    expect(typeof editor.commands.undo).toBe("function");
    expect(typeof editor.commands.redo).toBe("function");
  });

  it("exposes editability state for toolbar controls", () => {
    const editable = createEditor({ extensions: [] });
    const readOnly = createEditor({ extensions: [], editable: false });

    expect(editable.isEditable()).toBe(true);
    expect(readOnly.isEditable()).toBe(false);
  });

  it("exposes history availability for undo and redo controls", () => {
    const editor = createEditor({ extensions: [] });

    expect(editor.canUndo()).toBe(false);
    expect(editor.canRedo()).toBe(false);

    editor.commands.setContent("<p>Changed</p>");

    expect(editor.canUndo()).toBe(true);
    expect(editor.canRedo()).toBe(false);

    editor.commands.undo();

    expect(editor.canUndo()).toBe(false);
    expect(editor.canRedo()).toBe(true);
  });

  it("registers mark extensions in the schema", () => {
    const editor = createEditor({ extensions: [BoldMarkExt] });
    expect(editor.schema.marks.bold).toBeDefined();
    expect(typeof editor.commands.toggleBold).toBe("function");
  });

  it("serializes text with marks to HTML", () => {
    const editor = createEditor({
      extensions: [BoldMarkExt],
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "bold", marks: [{ type: "bold" }] },
            ],
          },
        ],
      },
    });
    expect(editor.getHTML()).toBe("<p><strong>bold</strong></p>");
  });

  it("does not emit selectionUpdate for an unchanged structural selection", () => {
    const editor = createEditor({ extensions: [] });
    let count = 0;
    editor.on("selectionUpdate", () => {
      count += 1;
    });

    editor.setSelection({
      anchor: { path: [0], offset: 0 },
      head: { path: [0], offset: 0 },
    });
    editor.setSelection({
      anchor: { path: [0], offset: 0 },
      head: { path: [0], offset: 0 },
    });

    expect(count).toBe(1);
  });

  it("clears stale selection when clearContent runs", () => {
    const editor = createEditor({
      content: "<p>Hello</p>",
      extensions: [],
    });
    editor.setSelection({
      anchor: { path: [0], offset: 2 },
      head: { path: [0], offset: 2 },
    });

    editor.commands.clearContent();

    expect(editor.getSelection()).toBeNull();
  });

  it("emits the editor in destroy lifecycle payloads", () => {
    const editor = createEditor({ extensions: [] });
    let received = false;
    editor.on("destroy", ({ editor: destroyedEditor }) => {
      received = destroyedEditor === editor;
    });

    editor.destroy();

    expect(received).toBe(true);
  });
  it("rejects extensions that try to redefine reserved nodes", () => {
    expect(() =>
      createEditor({
        extensions: [
          {
            name: "bad",
            nodes: [{ name: "doc", group: "block" }],
          },
        ],
      }),
    ).toThrow(/reserved node/);
  });
});
