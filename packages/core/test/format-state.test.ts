/**
 * Formatting state for toolbars: a bare caret targets the word under it,
 * the current mark attrs are readable, and equal neighbouring marks are
 * rendered as one element in a stable order.
 */

import { describe, it, expect } from "vitest";
import {
  compileSchema,
  selectionHasMark,
  selectionMarkAttrs,
  serializeToHTML,
  setMarkAcrossSelection,
  toggleMarkInDoc,
} from "../src/index.js";
import type { DocumentJSON, EditorSelection } from "../src/index.js";

const schema = compileSchema([
  {
    name: "paragraph",
    nodes: [
      {
        name: "paragraph",
        group: "block",
        content: "inline*",
        toDOM: () => ["p", 0],
        parseDOM: [{ tag: "p" }],
      },
    ],
  },
  {
    name: "marks",
    marks: [
      { name: "highlight", toDOM: (m) => ["mark", { style: `background-color: ${m.attrs?.color}` }, 0] },
      { name: "color", toDOM: (m) => ["span", { style: `color: ${m.attrs?.color}` }, 0] },
      { name: "bold", toDOM: () => ["strong", 0] },
      { name: "underline", rank: 2, toDOM: () => ["u", 0] },
    ],
  },
]);

function doc(content: DocumentJSON["content"][number]["content"]): DocumentJSON {
  return { type: "doc", content: [{ type: "paragraph", content }] };
}

const caret = (offset: number): EditorSelection => ({
  anchor: { path: [0], offset },
  head: { path: [0], offset },
});

describe("bare caret targets the word under it", () => {
  it("colours only the word, not the whole paragraph", () => {
    const next = setMarkAcrossSelection(doc([{ type: "text", text: "Hello world again" }]), caret(8), {
      type: "color",
      attrs: { color: "red" },
    })!;
    const content = next.content[0].content!;
    expect(content.map((n) => n.text)).toEqual(["Hello ", "world", " again"]);
    expect(content[1].marks).toEqual([{ type: "color", attrs: { color: "red" } }]);
    expect(content[0].marks).toBeUndefined();
  });

  it("uses the word the caret touches at its end", () => {
    const next = toggleMarkInDoc(doc([{ type: "text", text: "one two" }]), caret(3), "bold")!;
    expect(next.content[0].content![0]).toEqual({ type: "text", text: "one", marks: [{ type: "bold" }] });
  });

  it("falls back to the whole block when no word is under the caret", () => {
    const next = toggleMarkInDoc(doc([{ type: "text", text: "a  b" }]), caret(2), "bold")!;
    expect(next.content[0].content!.every((n) => n.marks?.[0]?.type === "bold")).toBe(true);
  });

  it("reports active state for the word the caret is in", () => {
    const d = doc([
      { type: "text", text: "plain " },
      { type: "text", text: "bold", marks: [{ type: "bold" }] },
    ]);
    expect(selectionHasMark(d, caret(8), "bold")).toBe(true);
    expect(selectionHasMark(d, caret(2), "bold")).toBe(false);
  });
});

describe("selectionMarkAttrs", () => {
  const d = doc([
    { type: "text", text: "red", marks: [{ type: "color", attrs: { color: "#ef4444" } }] },
    { type: "text", text: " plain" },
  ]);

  it("returns the attrs of the mark on the selection", () => {
    expect(selectionMarkAttrs(d, caret(1), "color")).toEqual({ color: "#ef4444" });
  });

  it("returns null when the mark covers only part of the selection", () => {
    const range = { anchor: { path: [0], offset: 0 }, head: { path: [0], offset: 9 } };
    expect(selectionMarkAttrs(d, range, "color")).toBeNull();
  });
});

describe("serializer mark grouping", () => {
  it("renders equal neighbouring marks as one element", () => {
    const html = serializeToHTML(
      doc([
        { type: "text", text: "a", marks: [{ type: "highlight", attrs: { color: "#ff0" } }] },
        {
          type: "text",
          text: "b",
          marks: [
            { type: "color", attrs: { color: "red" } },
            { type: "highlight", attrs: { color: "#ff0" } },
          ],
        },
      ]),
      schema,
    );
    expect(html).toBe(
      '<p><mark style="background-color: #ff0">a<span style="color: red">b</span></mark></p>',
    );
  });

  it("renders a higher-rank mark inside lower-rank ones", () => {
    const html = serializeToHTML(
      doc([{ type: "text", text: "x", marks: [{ type: "underline" }, { type: "color", attrs: { color: "red" } }] }]),
      schema,
    );
    expect(html).toBe('<p><span style="color: red"><u>x</u></span></p>');
  });

  it("uses the same nesting regardless of the marks array order", () => {
    const a = serializeToHTML(
      doc([{ type: "text", text: "x", marks: [{ type: "bold" }, { type: "color", attrs: { color: "red" } }] }]),
      schema,
    );
    const b = serializeToHTML(
      doc([{ type: "text", text: "x", marks: [{ type: "color", attrs: { color: "red" } }, { type: "bold" }] }]),
      schema,
    );
    expect(a).toBe(b);
  });
});
