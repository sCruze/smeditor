/**
 * Tests for CollabSession — the OT transport layer.
 *
 * The key property: two sessions making concurrent edits, each
 * receiving the other's operations, converge on the same document.
 */

import { describe, it, expect } from "vitest";
import { CollabSession, type Operation } from "../src/index.js";
import type { DocumentJSON } from "@smeditor/core";

/** A one-paragraph document with the given text. */
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

describe("CollabSession — local edits", () => {
  it("applies a local edit optimistically", () => {
    const s = new CollabSession(docOf("hello"), 1);
    s.applyLocal(insert(5, "!"));
    expect(blockText(s.getDocument())).toBe("hello!");
    expect(s.hasUnsyncedWork()).toBe(true);
  });

  it("flush moves pending edits in-flight", () => {
    const s = new CollabSession(docOf("hi"), 1);
    s.applyLocal(insert(2, "!"));
    const batch = s.flush();
    expect(batch).not.toBeNull();
    expect(batch!.ops).toHaveLength(1);
    expect(batch!.revision).toBe(0);
    // Nothing new to flush while the batch is in flight.
    expect(s.flush()).toBeNull();
  });

  it("ack clears in-flight work and advances the revision", () => {
    const s = new CollabSession(docOf("hi"), 1);
    s.applyLocal(insert(2, "!"));
    s.flush();
    s.ack();
    expect(s.getRevision()).toBe(1);
    expect(s.hasUnsyncedWork()).toBe(false);
  });
});

describe("CollabSession — remote operations", () => {
  it("applies a remote op transformed past local work", () => {
    // local doc "hello"; we inserted "X" at 0 -> "Xhello"
    const s = new CollabSession(docOf("hello"), 2);
    s.applyLocal(insert(0, "X"));
    // a remote peer inserts "Y" at offset 5 (end of "hello")
    s.receive(insert(5, "Y"), 1);
    // remote offset shifts right past our 1-char insert -> "XhelloY"
    expect(blockText(s.getDocument())).toBe("XhelloY");
    expect(s.getRevision()).toBe(1);
  });
});

describe("CollabSession — convergence", () => {
  it("two peers editing concurrently converge", () => {
    // Both start from "AB". Client 1 inserts "1" at 0; client 2
    // inserts "2" at 2. Each then receives the other's op.
    const a = new CollabSession(docOf("AB"), 1);
    const b = new CollabSession(docOf("AB"), 2);

    const opA = insert(0, "1");
    const opB = insert(2, "2");
    a.applyLocal(opA);
    b.applyLocal(opB);

    a.receive(opB, 2);
    b.receive(opA, 1);

    expect(blockText(a.getDocument())).toBe(blockText(b.getDocument()));
    expect(blockText(a.getDocument())).toBe("1AB2");
  });

  it("converges when both insert at the same offset", () => {
    const a = new CollabSession(docOf("AB"), 1);
    const b = new CollabSession(docOf("AB"), 2);

    const opA = insert(1, "a");
    const opB = insert(1, "b");
    a.applyLocal(opA);
    b.applyLocal(opB);

    a.receive(opB, 2);
    b.receive(opA, 1);

    // Lower clientId (1) is ordered first: "AabB" on both.
    expect(blockText(a.getDocument())).toBe(blockText(b.getDocument()));
    expect(blockText(a.getDocument())).toBe("AabB");
  });

  it("converges with a concurrent insert and delete", () => {
    const a = new CollabSession(docOf("hello"), 1);
    const b = new CollabSession(docOf("hello"), 2);

    const opA: Operation = { type: "delete", path: [0], offset: 0, length: 2 };
    const opB = insert(5, "!");
    a.applyLocal(opA);
    b.applyLocal(opB);

    a.receive(opB, 2);
    b.receive(opA, 1);

    expect(blockText(a.getDocument())).toBe(blockText(b.getDocument()));
    expect(blockText(a.getDocument())).toBe("llo!");
  });
});
