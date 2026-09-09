/**
 * @smeditor/collab — MemoryHub
 *
 * An in-memory server that relays operations between `CollabSession`s
 * with correct **server-side operational transform**.
 *
 * The hub is authoritative: it keeps an ordered log of committed
 * operations and a revision counter. When a client submits a batch
 * composed against revision R, the hub transforms it against every
 * operation committed since R, appends the result to the log, and
 * relays the transformed operations to the other clients. This is
 * what makes concurrent edits converge — a client that has already
 * acknowledged its own edit still sees later remote edits arrive
 * correctly transformed.
 *
 * It exists to exercise multi-client convergence end to end without a
 * network, and to define the server behaviour a real WebSocket
 * backend implements. Everything here is synchronous and pure.
 */

import { transformOperation, type Operation } from "./index.js";
import type { CollabSession, OutboundBatch } from "./session.js";

interface Member {
  clientId: number;
  session: CollabSession;
}

/** A committed operation together with the client that authored it. */
interface LoggedOp {
  op: Operation;
  clientId: number;
}

export class MemoryHub {
  private readonly members: Member[] = [];
  /** Every committed operation, in commit order. */
  private readonly log: LoggedOp[] = [];

  /** Register a session so it sends and receives operations. */
  join(session: CollabSession): void {
    if (this.members.some((m) => m.clientId === session.getClientId())) {
      throw new Error(
        `clientId ${session.getClientId()} already joined this hub`,
      );
    }
    this.members.push({ clientId: session.getClientId(), session });
  }

  /** Number of connected sessions. */
  get size(): number {
    return this.members.length;
  }

  /** The server's current revision (length of the committed log). */
  get revision(): number {
    return this.log.length;
  }

  /**
   * Commit a batch. The batch was composed against `batch.revision`;
   * the hub transforms each operation past everything committed since
   * then, appends it, and relays the transformed operations to the
   * other members.
   */
  submit(batch: OutboundBatch): void {
    const sender = this.members.find((m) => m.clientId === batch.clientId);
    if (!sender) return;

    // Operations committed since the batch's base revision.
    const concurrent = this.log.slice(batch.revision);

    let committed = 0;
    for (const raw of batch.ops) {
      // Transform the submitted op past each concurrent committed op.
      // The lower clientId is ordered first — a consistent tie-break.
      // A transform can split one op into several (a delete around a
      // concurrent insert), so thread a list through the concurrency.
      let ops: Operation[] = [raw];
      for (const c of concurrent) {
        const priority = batch.clientId < c.clientId ? "left" : "right";
        const next: Operation[] = [];
        for (const o of ops) {
          const r = transformOperation(o, c.op, priority);
          if (Array.isArray(r)) next.push(...r);
          else next.push(r);
        }
        ops = next;
      }
      for (const op of ops) {
        this.log.push({ op, clientId: batch.clientId });
        committed += 1;
        // Relay the committed (transformed) op to everyone else.
        for (const m of this.members) {
          if (m.clientId === batch.clientId) continue;
          m.session.receive(op, batch.clientId);
        }
      }
    }
    // Tell the sender how many ops actually committed so its revision
    // stays in lock-step with the server log even when a delete split.
    sender.session.ack(committed);
  }

  /**
   * Sync one client: take its queued batch and commit it. A no-op if
   * the client has nothing queued or a batch is already in flight.
   */
  sync(clientId: number): void {
    const member = this.members.find((m) => m.clientId === clientId);
    if (!member) return;
    const batch = member.session.flush();
    if (batch) this.submit(batch);
  }

  /**
   * Sync every member once, in join order. Repeats until no member
   * has queued work, so edits that were queued behind an in-flight
   * batch are flushed too. Afterwards every session has converged.
   */
  syncAll(): void {
    let active = true;
    let guard = 0;
    while (active && guard++ < 100) {
      active = false;
      for (const m of this.members) {
        if (m.session.hasUnsyncedWork()) {
          this.sync(m.clientId);
          active = true;
        }
      }
    }
  }
}
