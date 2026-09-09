/**
 * Tests for undo/redo history, including the typing-coalesce behaviour
 * that groups a run of edits in one block into a single undo step.
 */

import { describe, it, expect } from "vitest";
import { History } from "../src/history.js";
import type { DocumentJSON } from "../src/types.js";

const doc = (text: string): DocumentJSON => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

const entry = (text: string) => ({ doc: doc(text), selection: null });

describe("History — basics", () => {
  it("records and undoes/redoes discrete steps", () => {
    const h = new History();
    h.record(entry("a"));
    h.record(entry("b"));
    expect(h.canUndo()).toBe(true);
    const u1 = h.undo(entry("c"));
    expect(u1?.doc.content[0].content?.[0].text).toBe("b");
    const u2 = h.undo(entry("b"));
    expect(u2?.doc.content[0].content?.[0].text).toBe("a");
    expect(h.canUndo()).toBe(false);
    // From "a", redo replays forward to the next state, "b".
    const r = h.redo(entry("a"));
    expect(r?.doc.content[0].content?.[0].text).toBe("b");
  });

  it("a new edit clears the redo stack", () => {
    const h = new History();
    h.record(entry("a"));
    h.undo(entry("b"));
    expect(h.canRedo()).toBe(true);
    h.record(entry("c"));
    expect(h.canRedo()).toBe(false);
  });
});

describe("History — coalescing", () => {
  it("collapses same-key edits inside the window into one step", () => {
    const h = new History({ coalesceMs: 500 });
    h.record(entry("h"), "input:0", 1000);
    h.record(entry("he"), "input:0", 1100);
    h.record(entry("hel"), "input:0", 1200);
    // Three keystrokes, one undo step (the pre-run snapshot).
    expect(h.undo(entry("hel"))).not.toBeNull();
    expect(h.canUndo()).toBe(false);
  });

  it("starts a new step when the key changes (different block)", () => {
    const h = new History({ coalesceMs: 500 });
    h.record(entry("a"), "input:0", 1000);
    h.record(entry("b"), "input:1", 1100);
    expect(h.undo(entry("x"))).not.toBeNull();
    expect(h.canUndo()).toBe(true); // second step still there
  });

  it("starts a new step once the window elapses", () => {
    const h = new History({ coalesceMs: 500 });
    h.record(entry("a"), "input:0", 1000);
    h.record(entry("ab"), "input:0", 2000); // > 500ms later
    expect(h.undo(entry("x"))).not.toBeNull();
    expect(h.canUndo()).toBe(true);
  });

  it("does not coalesce edits without a key (commands)", () => {
    const h = new History({ coalesceMs: 500 });
    h.record(entry("a"), undefined, 1000);
    h.record(entry("b"), undefined, 1010);
    expect(h.undo(entry("x"))).not.toBeNull();
    expect(h.canUndo()).toBe(true);
  });

  it("the edit right after an undo is not coalesced onto the restored state", () => {
    const h = new History({ coalesceMs: 500 });
    h.record(entry("a"), "input:0", 1000);
    h.undo(entry("b"));
    h.record(entry("c"), "input:0", 1100);
    expect(h.undo(entry("d"))).not.toBeNull();
  });
});
