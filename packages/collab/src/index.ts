/**
 * @smeditor/collab
 *
 * Groundwork for real-time collaboration (§14, phase 3): a document
 * **operation model**.
 *
 * An edit is expressed as a serialisable `Operation` — an insert or a
 * delete of inline text, addressed by block path and character
 * offset. Operations can be applied, inverted (for undo), and
 * **transformed** against one another so two editors making
 * concurrent edits converge on the same document.
 *
 * This is the layer a sync transport (CRDT- or OT-based) builds on.
 * Everything here is pure and synchronous — no network, no editor —
 * so it's testable in isolation. The transport itself (version
 * vectors, presence, remote cursors) is a later step.
 */

import type { DocumentJSON } from "@smeditor/core";
import {
  nodeAt,
  mapNodeAt,
  insertInlineAt,
  deleteInlineRange,
  blockVisibleText,
} from "@smeditor/core";

// ============================================================================
// Operation model
// ============================================================================

/** Insert `text` into the block at `path`, at character `offset`. */
export interface InsertOp {
  type: "insert";
  path: number[];
  offset: number;
  text: string;
}

/** Delete `length` characters from the block at `path`, from `offset`. */
export interface DeleteOp {
  type: "delete";
  path: number[];
  offset: number;
  length: number;
}

export type Operation = InsertOp | DeleteOp;

/** Same block? Operations on different blocks are independent. */
function sameBlock(a: Operation, b: Operation): boolean {
  return a.path.length === b.path.length && a.path.every((v, i) => v === b.path[i]);
}

// ============================================================================
// Apply
// ============================================================================

/**
 * Apply an operation to a document, returning a new document. An
 * operation addressing a missing block returns the document
 * unchanged.
 */
export function applyOperation(
  doc: DocumentJSON,
  op: Operation,
): DocumentJSON {
  const block = nodeAt(doc, op.path);
  if (!block) return doc;
  if (op.type === "insert") {
    const content = insertInlineAt(block.content ?? [], op.offset, [
      { type: "text", text: op.text },
    ]);
    return mapNodeAt(doc, op.path, (b) => ({ ...b, content }));
  }
  const content = deleteInlineRange(
    block.content ?? [],
    op.offset,
    op.offset + op.length,
  );
  return mapNodeAt(doc, op.path, (b) => ({ ...b, content }));
}

/** Apply a sequence of operations in order. */
export function applyOperations(
  doc: DocumentJSON,
  ops: Operation[],
): DocumentJSON {
  return ops.reduce(applyOperation, doc);
}

// ============================================================================
// Invert
// ============================================================================

/**
 * The inverse of `op` against the document it would apply to —
 * `applyOperation(applyOperation(doc, op), invertOperation(doc, op))`
 * equals `doc`. Used to undo a remote operation.
 */
export function invertOperation(
  doc: DocumentJSON,
  op: Operation,
): Operation {
  if (op.type === "insert") {
    return {
      type: "delete",
      path: op.path,
      offset: op.offset,
      length: op.text.length,
    };
  }
  // Capture the text being deleted so the inverse can restore it.
  const block = nodeAt(doc, op.path);
  const text = block
    ? blockVisibleText(block).slice(op.offset, op.offset + op.length)
    : "";
  return { type: "insert", path: op.path, offset: op.offset, text };
}

// ============================================================================
// Operational transform
// ============================================================================

/**
 * Transform `op` so it can be applied *after* `against`, where the
 * two were created concurrently against the same document. With this,
 * two editors applying each other's operations converge.
 *
 * `priority` breaks ties when two inserts land at the same offset:
 * "left" keeps `op` before `against` (its offset is unchanged),
 * "right" pushes it after.
 */
export function transformOperation(
  op: Operation,
  against: Operation,
  priority: "left" | "right" = "left",
): Operation | Operation[] {
  // Edits in different blocks don't affect each other.
  if (!sameBlock(op, against)) return op;

  if (against.type === "insert") {
    const shift = against.text.length;
    const at = against.offset;
    // A concurrent insert that lands strictly inside a delete must not
    // be swallowed by it. Split the delete so it removes the original
    // text on either side of the inserted run and leaves the insert in
    // place — this is what makes delete-vs-insert converge (TP1). A
    // single contiguous delete cannot skip the inserted hole, so the
    // transform returns two deletes to apply in sequence.
    if (op.type === "delete") {
      const delStart = op.offset;
      const delEnd = op.offset + op.length;
      if (at > delStart && at < delEnd) {
        return [
          {
            type: "delete",
            path: op.path,
            offset: delStart,
            length: at - delStart,
          },
          {
            type: "delete",
            path: op.path,
            offset: delStart + shift,
            length: delEnd - at,
          },
        ];
      }
    }
    // An insert strictly before us, or at our offset when we yield,
    // pushes us right.
    if (at < op.offset || (at === op.offset && priority === "right")) {
      return { ...op, offset: op.offset + shift };
    }
    return op;
  }

  // against is a delete.
  const delStart = against.offset;
  const delEnd = against.offset + against.length;

  if (op.type === "insert") {
    if (delEnd <= op.offset) {
      return { ...op, offset: op.offset - against.length };
    }
    if (delStart >= op.offset) return op;
    // Our insert point fell inside the deleted range — clamp to its start.
    return { ...op, offset: delStart };
  }

  // op is a delete vs a delete — remove the overlapping span.
  const opStart = op.offset;
  const opEnd = op.offset + op.length;
  const overlap = Math.max(
    0,
    Math.min(opEnd, delEnd) - Math.max(opStart, delStart),
  );
  const newLength = Math.max(0, op.length - overlap);
  // Shift left by however much of `against` lay before our start.
  const before = Math.max(0, Math.min(delEnd, opStart) - delStart);
  return { ...op, offset: op.offset - before, length: newLength };
}

/**
 * Transform `op` against a sequence of operations, in order. A single
 * transform may split an op into several (a delete around a concurrent
 * insert); each resulting op is then transformed against the remaining
 * `against` ops, so the return is one op or a list.
 */
export function transformAgainst(
  op: Operation,
  against: Operation[],
  priority: "left" | "right" = "left",
): Operation | Operation[] {
  let ops: Operation[] = [op];
  for (const a of against) {
    const next: Operation[] = [];
    for (const o of ops) {
      const r = transformOperation(o, a, priority);
      if (Array.isArray(r)) next.push(...r);
      else next.push(r);
    }
    ops = next;
  }
  return ops.length === 1 ? ops[0] : ops;
}

// ============================================================================
// Transport layer
// ============================================================================

export { CollabSession } from "./session.js";
export type { OutboundBatch } from "./session.js";

export { MemoryHub } from "./hub.js";

// ============================================================================
// Presence / awareness
// ============================================================================

export {
  PresenceMap,
  transformCursorPoint,
  transformPresence,
  transformPresenceAgainst,
} from "./presence.js";
export type { CursorPoint, Presence } from "./presence.js";

// ============================================================================
// Transport / network
// ============================================================================

export { CollabClient, WebSocketTransport } from "./transport.js";
export type {
  Transport,
  CollabClientOptions,
  ClientMessage,
  ServerMessage,
  SubmitMessage,
  PresenceMessage,
  AckMessage,
  RemoteOpMessage,
  RemotePresenceMessage,
  PeerLeftMessage,
} from "./transport.js";
