/**
 * Tests for the collab operation model — apply, invert, and
 * operational transform.
 */

import { describe, it, expect } from "vitest";
import {
  applyOperation,
  applyOperations,
  invertOperation,
  transformOperation,
  type Operation,
} from "../src/index.js";
import { blockVisibleText } from "@smeditor/core";
import type { DocumentJSON } from "@smeditor/core";

/** A one-paragraph document. */
function doc(text: string): DocumentJSON {
  return {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text }] },
    ],
  };
}

const blockText = (d: DocumentJSON): string =>
  blockVisibleText(d.content[0]);

describe("applyOperation", () => {
  it("applies an insert", () => {
    const op: Operation = {
      type: "insert",
      path: [0],
      offset: 2,
      text: "XY",
    };
    expect(blockText(applyOperation(doc("abcd"), op))).toBe("abXYcd");
  });

  it("applies a delete", () => {
    const op: Operation = {
      type: "delete",
      path: [0],
      offset: 1,
      length: 2,
    };
    expect(blockText(applyOperation(doc("abcd"), op))).toBe("ad");
  });

  it("leaves an off-tree path unchanged", () => {
    const op: Operation = {
      type: "insert",
      path: [9],
      offset: 0,
      text: "x",
    };
    const d = doc("abcd");
    expect(applyOperation(d, op)).toBe(d);
  });
});

describe("invertOperation", () => {
  it("an insert inverts to a delete that undoes it", () => {
    const d = doc("abcd");
    const op: Operation = {
      type: "insert",
      path: [0],
      offset: 2,
      text: "XY",
    };
    const after = applyOperation(d, op);
    const undo = invertOperation(d, op);
    expect(blockText(applyOperation(after, undo))).toBe("abcd");
  });

  it("a delete inverts to an insert restoring the text", () => {
    const d = doc("abcd");
    const op: Operation = {
      type: "delete",
      path: [0],
      offset: 1,
      length: 2,
    };
    const after = applyOperation(d, op);
    const undo = invertOperation(d, op);
    expect(blockText(applyOperation(after, undo))).toBe("abcd");
  });
});

describe("transformOperation — convergence", () => {
  it("two concurrent inserts converge", () => {
    const base = doc("abcd");
    // A inserts "X" at 1; B inserts "Y" at 3.
    const a: Operation = { type: "insert", path: [0], offset: 1, text: "X" };
    const b: Operation = { type: "insert", path: [0], offset: 3, text: "Y" };
    // Site 1: apply a, then b transformed against a.
    const s1 = applyOperation(
      applyOperation(base, a),
      transformOperation(b, a),
    );
    // Site 2: apply b, then a transformed against b.
    const s2 = applyOperation(
      applyOperation(base, b),
      transformOperation(a, b),
    );
    expect(blockText(s1)).toBe(blockText(s2));
    expect(blockText(s1)).toBe("aXbcYd");
  });

  it("an insert converges against a concurrent delete", () => {
    const base = doc("abcdef");
    const a: Operation = { type: "insert", path: [0], offset: 4, text: "X" };
    const b: Operation = { type: "delete", path: [0], offset: 1, length: 2 };
    const s1 = applyOperation(
      applyOperation(base, a),
      transformOperation(b, a),
    );
    const s2 = applyOperation(
      applyOperation(base, b),
      transformOperation(a, b),
    );
    expect(blockText(s1)).toBe(blockText(s2));
  });

  it("two concurrent deletes converge", () => {
    const base = doc("abcdefgh");
    const a: Operation = { type: "delete", path: [0], offset: 1, length: 3 };
    const b: Operation = { type: "delete", path: [0], offset: 2, length: 3 };
    const s1 = applyOperation(
      applyOperation(base, a),
      transformOperation(b, a),
    );
    const s2 = applyOperation(
      applyOperation(base, b),
      transformOperation(a, b),
    );
    expect(blockText(s1)).toBe(blockText(s2));
  });

  it("a delete splits around a concurrent insert and converges (TP1)", () => {
    // base "abcdef"; A deletes "bcd" [1,4); B inserts "X" at 2, strictly
    // inside A's deleted range. The insert must survive on BOTH sites.
    const base = doc("abcdef");
    const a: Operation = { type: "delete", path: [0], offset: 1, length: 3 };
    const b: Operation = { type: "insert", path: [0], offset: 2, text: "X" };
    const apply = (d: DocumentJSON, r: Operation | Operation[]): DocumentJSON =>
      Array.isArray(r) ? applyOperations(d, r) : applyOperation(d, r);
    // Site 1 (authored A): apply A, then B transformed against A.
    const s1 = apply(applyOperation(base, a), transformOperation(b, a));
    // Site 2 (authored B): apply B, then A transformed against B (splits).
    const s2 = apply(applyOperation(base, b), transformOperation(a, b));
    expect(blockText(s1)).toBe(blockText(s2));
    expect(blockText(s1)).toBe("aXef");
  });

  it("operations in different blocks are independent", () => {
    const a: Operation = { type: "insert", path: [0], offset: 0, text: "X" };
    const b: Operation = { type: "insert", path: [1], offset: 0, text: "Y" };
    expect(transformOperation(a, b)).toEqual(a);
  });

  it("tie-break: right priority pushes the insert after", () => {
    const a: Operation = { type: "insert", path: [0], offset: 2, text: "A" };
    const b: Operation = { type: "insert", path: [0], offset: 2, text: "B" };
    expect(transformOperation(a, b, "left").offset).toBe(2);
    expect(transformOperation(a, b, "right").offset).toBe(3);
  });
});

describe("applyOperations", () => {
  it("applies a sequence in order", () => {
    const ops: Operation[] = [
      { type: "insert", path: [0], offset: 4, text: "!" },
      { type: "delete", path: [0], offset: 0, length: 1 },
    ];
    expect(blockText(applyOperations(doc("abcd"), ops))).toBe("bcd!");
  });
});
