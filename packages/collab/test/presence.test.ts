/**
 * Tests for collaboration presence — cursors transformed through OT.
 */

import { describe, it, expect } from "vitest";
import {
  PresenceMap,
  transformCursorPoint,
  transformPresence,
  type Operation,
  type Presence,
} from "../src/index.js";

const insert = (offset: number, text: string): Operation => ({
  type: "insert",
  path: [0],
  offset,
  text,
});
const del = (offset: number, length: number): Operation => ({
  type: "delete",
  path: [0],
  offset,
  length,
});

describe("transformCursorPoint", () => {
  it("shifts a cursor right past an earlier insert", () => {
    const p = transformCursorPoint({ path: [0], offset: 5 }, insert(2, "abc"));
    expect(p.offset).toBe(8);
  });

  it("leaves a cursor at the insert point unchanged", () => {
    const p = transformCursorPoint({ path: [0], offset: 5 }, insert(5, "abc"));
    expect(p.offset).toBe(5);
  });

  it("shifts a cursor left past an earlier delete", () => {
    const p = transformCursorPoint({ path: [0], offset: 8 }, del(2, 3));
    expect(p.offset).toBe(5);
  });

  it("clamps a cursor inside a deleted range to its start", () => {
    const p = transformCursorPoint({ path: [0], offset: 5 }, del(3, 6));
    expect(p.offset).toBe(3);
  });

  it("ignores an edit in another block", () => {
    const p = transformCursorPoint({ path: [1], offset: 5 }, insert(0, "x"));
    expect(p.offset).toBe(5);
  });
});

describe("transformPresence", () => {
  it("transforms both selection endpoints", () => {
    const presence: Presence = {
      clientId: 2,
      anchor: { path: [0], offset: 3 },
      head: { path: [0], offset: 7 },
    };
    const out = transformPresence(presence, insert(0, "XX"));
    expect(out.anchor.offset).toBe(5);
    expect(out.head.offset).toBe(9);
  });
});

describe("PresenceMap", () => {
  function presenceOf(id: number, offset: number): Presence {
    return {
      clientId: id,
      anchor: { path: [0], offset },
      head: { path: [0], offset },
    };
  }

  it("tracks and lists peers", () => {
    const map = new PresenceMap();
    map.set(presenceOf(1, 2));
    map.set(presenceOf(2, 4));
    expect(map.size).toBe(2);
    expect(map.get(1)?.anchor.offset).toBe(2);
  });

  it("replaces a peer's presence on update", () => {
    const map = new PresenceMap();
    map.set(presenceOf(1, 2));
    map.set(presenceOf(1, 9));
    expect(map.size).toBe(1);
    expect(map.get(1)?.anchor.offset).toBe(9);
  });

  it("removes a disconnected peer", () => {
    const map = new PresenceMap();
    map.set(presenceOf(1, 2));
    map.remove(1);
    expect(map.size).toBe(0);
  });

  it("transforms every stored cursor when an operation applies", () => {
    const map = new PresenceMap();
    map.set(presenceOf(1, 5));
    map.set(presenceOf(2, 8));
    map.applyOperation(insert(0, "XYZ"));
    expect(map.get(1)?.anchor.offset).toBe(8);
    expect(map.get(2)?.anchor.offset).toBe(11);
  });
});
