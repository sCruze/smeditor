/**
 * @smeditor/collab — CollabSession
 *
 * The transport layer on top of the operation model. A
 * `CollabSession` is one editor's view of a shared document. It:
 *
 *   - applies local edits immediately (optimistic),
 *   - tracks which local operations are *in flight* (sent, awaiting
 *     the server's acknowledgement) and which are still *pending*,
 *   - transforms incoming remote operations against the local ones
 *     so every session converges on the same document.
 *
 * Convergence tie-breaks use `clientId`: when two edits land at the
 * same offset, the one from the lower clientId is ordered first.
 * This makes the transform asymmetric and consistent across peers.
 *
 * Everything here is pure and synchronous — a real WebSocket
 * transport plugs in by calling `flush()` to get a batch to send,
 * `ack()` when the server confirms it, and `receive()` for each
 * remote operation. No network code lives here.
 */

import type { DocumentJSON } from "@smeditor/core";
import {
  applyOperation,
  applyOperations,
  transformOperation,
  transformAgainst,
  type Operation,
} from "./index.js";

/** Flatten a transform result (one op or a split into several). */
function asOps(result: Operation | Operation[]): Operation[] {
  return Array.isArray(result) ? result : [result];
}

/** A batch of local operations ready to send to the server. */
export interface OutboundBatch {
  /** The server revision these operations were composed against. */
  revision: number;
  clientId: number;
  ops: Operation[];
}

export class CollabSession {
  private doc: DocumentJSON;
  private readonly clientId: number;
  private revision: number;

  /** Sent to the server, not yet acknowledged. */
  private inflight: Operation[] = [];
  /** Edited locally, not yet sent. */
  private pending: Operation[] = [];

  constructor(doc: DocumentJSON, clientId: number, revision = 0) {
    this.doc = doc;
    this.clientId = clientId;
    this.revision = revision;
  }

  /** The session's current document. */
  getDocument(): DocumentJSON {
    return this.doc;
  }

  /** The last server revision this session has seen. */
  getRevision(): number {
    return this.revision;
  }

  getClientId(): number {
    return this.clientId;
  }

  /** True while there are local operations the server hasn't seen. */
  hasUnsyncedWork(): boolean {
    return this.inflight.length > 0 || this.pending.length > 0;
  }

  /**
   * Apply a local edit immediately and queue it for sending. The
   * document updates optimistically — the operation is reconciled
   * with the server later.
   */
  applyLocal(op: Operation): void {
    this.doc = applyOperation(this.doc, op);
    this.pending.push(op);
  }

  /**
   * Take the next batch of operations to send. Returns null when
   * something is already in flight (the server processes one batch
   * per client at a time) or there is nothing pending.
   */
  flush(): OutboundBatch | null {
    if (this.inflight.length > 0 || this.pending.length === 0) return null;
    this.inflight = this.pending;
    this.pending = [];
    return {
      revision: this.revision,
      clientId: this.clientId,
      ops: this.inflight,
    };
  }

  /**
   * The server acknowledged the in-flight batch. Its operations are
   * now part of the shared history; the revision advances by the
   * batch size.
   */
  ack(committedCount?: number): void {
    // The server may commit MORE ops than were submitted when a delete
    // splits around a concurrent insert, so the authoritative count
    // comes from the hub. Fall back to the batch size when unspecified.
    this.revision += committedCount ?? this.inflight.length;
    this.inflight = [];
  }

  /**
   * A remote operation arrived. It was composed by `remoteClientId`
   * against the same revision this session is on. The operation is
   * transformed against the local in-flight and pending operations
   * before being applied; the local operations are transformed
   * against it so they stay valid.
   */
  receive(op: Operation, remoteClientId: number): void {
    // Lower clientId wins a tie — that peer's edit is ordered first.
    const remoteWins = remoteClientId < this.clientId;
    const remotePriority = remoteWins ? "left" : "right";
    const localPriority = remoteWins ? "right" : "left";

    // Transform the remote op past everything we've done locally,
    // then apply it. The transform may split it into several ops.
    const local = [...this.inflight, ...this.pending];
    this.doc = applyOperations(
      this.doc,
      asOps(transformAgainst(op, local, remotePriority)),
    );

    // Transform our own operations past the remote op so they remain
    // addressed correctly against the new document. A local delete may
    // split around the remote insert, so flatten the results.
    this.inflight = this.inflight.flatMap((o) =>
      asOps(transformOperation(o, op, localPriority)),
    );
    this.pending = this.pending.flatMap((o) =>
      asOps(transformOperation(o, op, localPriority)),
    );

    this.revision += 1;
  }
}
