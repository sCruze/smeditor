/**
 * Tests for MemoryHub — multi-client convergence through an in-memory
 * relay. The property under test: however several clients edit
 * concurrently, once the hub has relayed everything every session
 * holds an identical document.
 */

import { describe, it, expect } from "vitest";
import {
  CollabSession,
  MemoryHub,
  type Operation,
} from "../src/index.js";
import type { DocumentJSON } from "@smeditor/core";

function docOf(text: string): DocumentJSON {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

const blockText = (doc: DocumentJSON): string =>
  (doc.content[0].content ?? []).map((n) => n.text ?? "").join("");

const insert = (offset: number, text: string): Operation => ({
  type: "insert",
  path: [0],
  offset,
  text,
});

describe("MemoryHub", () => {
  it("relays one client's edit to the others", () => {
    const hub = new MemoryHub();
    const a = new CollabSession(docOf("hi"), 1);
    const b = new CollabSession(docOf("hi"), 2);
    hub.join(a);
    hub.join(b);

    a.applyLocal(insert(2, "!"));
    hub.sync(1);

    expect(blockText(b.getDocument())).toBe("hi!");
    expect(a.hasUnsyncedWork()).toBe(false);
  });

  it("rejects a duplicate clientId", () => {
    const hub = new MemoryHub();
    hub.join(new CollabSession(docOf(""), 1));
    expect(() => hub.join(new CollabSession(docOf(""), 1))).toThrow();
  });

  it("three clients editing concurrently converge", () => {
    const hub = new MemoryHub();
    const a = new CollabSession(docOf("MID"), 1);
    const b = new CollabSession(docOf("MID"), 2);
    const c = new CollabSession(docOf("MID"), 3);
    hub.join(a);
    hub.join(b);
    hub.join(c);

    a.applyLocal(insert(0, "<"));
    b.applyLocal(insert(3, ">"));
    c.applyLocal(insert(1, "."));

    hub.syncAll();

    const ta = blockText(a.getDocument());
    expect(blockText(b.getDocument())).toBe(ta);
    expect(blockText(c.getDocument())).toBe(ta);
    // All three edits landed.
    expect(ta).toContain("<");
    expect(ta).toContain(">");
    expect(ta).toContain(".");
    expect(ta.length).toBe(6);
  });

  it("converges across several sync rounds", () => {
    const hub = new MemoryHub();
    const a = new CollabSession(docOf("X"), 1);
    const b = new CollabSession(docOf("X"), 2);
    hub.join(a);
    hub.join(b);

    // Round 1
    a.applyLocal(insert(0, "a"));
    b.applyLocal(insert(1, "b"));
    hub.syncAll();
    expect(blockText(a.getDocument())).toBe(blockText(b.getDocument()));

    // Round 2 — edit again from the converged state
    a.applyLocal(insert(0, "A"));
    b.applyLocal(insert(blockText(b.getDocument()).length, "B"));
    hub.syncAll();
    expect(blockText(a.getDocument())).toBe(blockText(b.getDocument()));
  });

  it("converges with concurrent inserts and deletes", () => {
    const hub = new MemoryHub();
    const a = new CollabSession(docOf("hello world"), 1);
    const b = new CollabSession(docOf("hello world"), 2);
    hub.join(a);
    hub.join(b);

    a.applyLocal({ type: "delete", path: [0], offset: 0, length: 6 });
    b.applyLocal(insert(11, "!"));

    hub.syncAll();

    expect(blockText(a.getDocument())).toBe(blockText(b.getDocument()));
    expect(blockText(a.getDocument())).toBe("world!");
  });

  it("converges when an insert lands inside a concurrent delete", () => {
    const hub = new MemoryHub();
    const a = new CollabSession(docOf("abcdef"), 1);
    const b = new CollabSession(docOf("abcdef"), 2);
    hub.join(a);
    hub.join(b);

    // A deletes "bcd" [1,4); B inserts "X" at 2 — strictly inside A's range.
    a.applyLocal({ type: "delete", path: [0], offset: 1, length: 3 });
    b.applyLocal(insert(2, "X"));

    hub.syncAll();

    expect(blockText(a.getDocument())).toBe(blockText(b.getDocument()));
    expect(blockText(a.getDocument())).toBe("aXef");
    // Both sessions track the same server revision after convergence.
    expect(a.getRevision()).toBe(hub.revision);
    expect(b.getRevision()).toBe(hub.revision);
  });
});
