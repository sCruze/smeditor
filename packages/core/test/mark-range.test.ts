/**
 * Regression tests for the deep, range-aware mark helpers and the
 * empty-block <br> filler. These cover the bugs where inline
 * formatting (colour, font size) leaked onto the whole block and
 * where empty paragraphs / table cells rendered with no caret target.
 */

import { describe, it, expect } from "vitest";
import {
  setMarkAcrossSelection,
  unsetMarkAcrossSelection,
  clearMarksAcrossSelection,
  toggleMarkInDoc,
  selectionHasMark,
  serializeToHTML,
  parseHTML,
  compileSchema,
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
    name: "color",
    marks: [
      {
        name: "color",
        toDOM: (m) => ["span", { style: `color: ${m.attrs?.c}` }, 0],
      },
    ],
  },
]);

function doc(text: string): DocumentJSON {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

function sel(from: number, to: number): EditorSelection {
  return {
    anchor: { path: [0], offset: from },
    head: { path: [0], offset: to },
  };
}

describe("setMarkAcrossSelection", () => {
  it("marks only the selected range, not the whole block", () => {
    const next = setMarkAcrossSelection(doc("Color me please"), sel(0, 5), {
      type: "color",
      attrs: { c: "red" },
    });
    expect(next).not.toBeNull();
    const content = next!.content[0].content!;
    expect(content[0].text).toBe("Color");
    expect(content[0].marks).toEqual([{ type: "color", attrs: { c: "red" } }]);
    expect(content[1].text).toBe(" me please");
    expect(content[1].marks).toBeUndefined();
  });

  it("replaces an existing mark of the same type instead of stacking", () => {
    const red = setMarkAcrossSelection(doc("text"), sel(0, 4), {
      type: "color",
      attrs: { c: "red" },
    })!;
    const blue = setMarkAcrossSelection(red, sel(0, 4), {
      type: "color",
      attrs: { c: "blue" },
    })!;
    const marks = blue.content[0].content![0].marks!;
    expect(marks.filter((m) => m.type === "color")).toHaveLength(1);
    expect(marks[0].attrs).toEqual({ c: "blue" });
  });

  it("falls back to the whole block for a collapsed caret", () => {
    const next = setMarkAcrossSelection(doc("whole"), sel(2, 2), {
      type: "color",
      attrs: { c: "red" },
    })!;
    expect(next.content[0].content![0].marks).toBeDefined();
  });

  it("unsetMarkAcrossSelection removes the mark from the range", () => {
    const red = setMarkAcrossSelection(doc("text"), sel(0, 4), {
      type: "color",
      attrs: { c: "red" },
    })!;
    const cleared = unsetMarkAcrossSelection(red, sel(0, 4), "color")!;
    expect(cleared.content[0].content![0].marks).toBeUndefined();
  });
});

describe("toggleMarkInDoc", () => {
  it("toggles only the selected span", () => {
    const next = toggleMarkInDoc(doc("hello"), sel(1, 4), "bold")!;
    const content = next.content[0].content!;
    expect(content.map((node) => node.text)).toEqual(["h", "ell", "o"]);
    expect(content[0].marks).toBeUndefined();
    expect(content[1].marks).toEqual([{ type: "bold" }]);
    expect(content[2].marks).toBeUndefined();
  });

  it("removes the mark only from the selected span when active", () => {
    const marked = toggleMarkInDoc(doc("hello"), sel(0, 5), "bold")!;
    const next = toggleMarkInDoc(marked, sel(1, 4), "bold")!;
    const content = next.content[0].content!;
    expect(content.map((node) => node.text)).toEqual(["h", "ell", "o"]);
    expect(content[0].marks).toEqual([{ type: "bold" }]);
    expect(content[1].marks).toBeUndefined();
    expect(content[2].marks).toEqual([{ type: "bold" }]);
  });
});

describe("selectionHasMark", () => {
  it("uses the selected range instead of the first text node in the block", () => {
    const start: DocumentJSON = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "a" },
            { type: "text", text: "b", marks: [{ type: "bold" }] },
            { type: "text", text: "c" },
          ],
        },
      ],
    };

    expect(selectionHasMark(start, sel(1, 2), "bold")).toBe(true);
    expect(selectionHasMark(start, sel(0, 1), "bold")).toBe(false);
  });
});

describe("empty-block <br> filler", () => {
  it("renders an empty paragraph with a <br> so the caret can land", () => {
    const html = serializeToHTML(
      { type: "doc", content: [{ type: "paragraph", content: [] }] },
      schema,
    );
    expect(html).toBe("<p><br></p>");
  });

  it("drops the filler <br> again on parse — no stray newline", () => {
    const parsed = parseHTML("<p><br></p>", schema);
    expect(parsed.content[0].type).toBe("paragraph");
    expect(parsed.content[0].content ?? []).toEqual([]);
  });

  it("keeps a <br> that has real content after it", () => {
    const parsed = parseHTML("<p>a<br>b</p>", schema);
    const text = (parsed.content[0].content ?? [])
      .map((n) => n.text ?? "")
      .join("");
    expect(text).toContain("a");
    expect(text).toContain("b");
  });
});

describe("clearMarksAcrossSelection", () => {
  it("clears marks on just the selected range, leaving the rest alone", () => {
    const start: DocumentJSON = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "red", marks: [{ type: "color", attrs: { c: "r" } }] },
            { type: "text", text: "blue", marks: [{ type: "color", attrs: { c: "b" } }] },
          ],
        },
      ],
    };
    const next = clearMarksAcrossSelection(start, sel(0, 3))!;
    const content = next.content[0].content!;
    expect(content[0].text).toBe("red");
    expect(content[0].marks).toBeUndefined();
    expect(content[content.length - 1].marks?.[0].attrs).toEqual({ c: "b" });
  });

  it("returns null when there's no mark to clear", () => {
    const plain: DocumentJSON = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "plain" }] }],
    };
    expect(clearMarksAcrossSelection(plain, sel(0, 5))).toBeNull();
  });

  it("falls back to the whole block for a collapsed caret", () => {
    const styled: DocumentJSON = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "marked", marks: [{ type: "color", attrs: { c: "r" } }] },
          ],
        },
      ],
    };
    const next = clearMarksAcrossSelection(styled, sel(2, 2))!;
    expect(next.content[0].content![0].marks).toBeUndefined();
  });
});
