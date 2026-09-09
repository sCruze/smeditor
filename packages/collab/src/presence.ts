/**
 * @smeditor/collab — presence
 *
 * Awareness state for collaboration: where each peer's caret and
 * selection are. A cursor is addressed the same way an operation is
 * — a block path and a character offset — so it can be transformed
 * through the same operational transform. As the document changes
 * under a remote cursor, the cursor stays anchored to the text it
 * pointed at.
 *
 * Pure and synchronous. The hub relays presence alongside operations;
 * the network binding is a later step.
 */

import type { Operation } from "./index.js";

/** One endpoint of a selection — a block path and character offset. */
export interface CursorPoint {
  path: number[];
  offset: number;
}

/** A peer's awareness state: who they are and where their selection is. */
export interface Presence {
  clientId: number;
  /** Display name, for a remote-cursor label. */
  name?: string;
  /** Cursor colour, for the remote-cursor caret / label. */
  color?: string;
  /** Selection anchor and head. A collapsed caret has anchor === head. */
  anchor: CursorPoint;
  head: CursorPoint;
}

/** Same block? A cursor in another block is unaffected by an edit. */
function sameBlock(path: number[], op: Operation): boolean {
  return (
    path.length === op.path.length &&
    path.every((v, i) => v === op.path[i])
  );
}

/**
 * Transform a single cursor point through an operation. A point in a
 * different block is returned unchanged.
 *
 * - An insert before the point shifts it right by the insert length;
 *   an insert exactly at the point leaves it (the user keeps typing
 *   ahead of a remote insert).
 * - A delete before the point shifts it left; a delete spanning the
 *   point clamps it to the deletion's start.
 */
export function transformCursorPoint(
  point: CursorPoint,
  op: Operation,
): CursorPoint {
  if (!sameBlock(point.path, op)) return point;

  if (op.type === "insert") {
    if (op.offset < point.offset) {
      return { ...point, offset: point.offset + op.text.length };
    }
    return point;
  }

  // delete
  const start = op.offset;
  const end = op.offset + op.length;
  if (end <= point.offset) {
    return { ...point, offset: point.offset - op.length };
  }
  if (start >= point.offset) return point;
  // The point fell inside the deleted range — clamp to its start.
  return { ...point, offset: start };
}

/** Transform a whole presence (both endpoints) through an operation. */
export function transformPresence(
  presence: Presence,
  op: Operation,
): Presence {
  return {
    ...presence,
    anchor: transformCursorPoint(presence.anchor, op),
    head: transformCursorPoint(presence.head, op),
  };
}

/** Transform a presence through a sequence of operations, in order. */
export function transformPresenceAgainst(
  presence: Presence,
  ops: Operation[],
): Presence {
  return ops.reduce(transformPresence, presence);
}

/**
 * A registry of remote peers' presence. The local session keeps one
 * of these, updates it when a peer broadcasts, and transforms every
 * stored cursor whenever an operation is applied — so remote carets
 * stay anchored as the document changes.
 */
export class PresenceMap {
  private readonly peers = new Map<number, Presence>();

  /** Insert or replace a peer's presence. */
  set(presence: Presence): void {
    this.peers.set(presence.clientId, presence);
  }

  /** Remove a peer (they disconnected). */
  remove(clientId: number): void {
    this.peers.delete(clientId);
  }

  /** A peer's current presence, if known. */
  get(clientId: number): Presence | undefined {
    return this.peers.get(clientId);
  }

  /** Every known peer presence. */
  all(): Presence[] {
    return [...this.peers.values()];
  }

  /** Number of tracked peers. */
  get size(): number {
    return this.peers.size;
  }

  /**
   * Transform every stored cursor through an operation — call this
   * whenever an operation is applied to the document so remote
   * cursors track the change.
   */
  applyOperation(op: Operation): void {
    for (const [id, presence] of this.peers) {
      this.peers.set(id, transformPresence(presence, op));
    }
  }
}
