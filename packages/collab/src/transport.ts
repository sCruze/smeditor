/**
 * @smeditor/collab — transport
 *
 * Connects a `CollabSession` (and a `PresenceMap`) to a server over a
 * message channel. This module defines:
 *
 *   - the **wire protocol** — the JSON messages client and server
 *     exchange,
 *   - a `Transport` interface — the minimal channel a session needs,
 *   - `WebSocketTransport` — a `Transport` over a browser WebSocket,
 *   - `CollabClient` — glue that drives a session + presence map from
 *     transport messages and pushes local changes back out.
 *
 * The protocol and `CollabClient` are pure and unit-tested with a
 * fake in-memory transport. `WebSocketTransport` is a thin adapter
 * whose runtime needs an actual server, so its end-to-end behaviour
 * is verified in a deployment, not here.
 */

import type { Operation } from "./index.js";
import { CollabSession } from "./session.js";
import { PresenceMap, type Presence } from "./presence.js";

// ============================================================================
// Wire protocol
// ============================================================================

/** Client -> server: a batch of operations to commit. */
export interface SubmitMessage {
  kind: "submit";
  revision: number;
  clientId: number;
  ops: Operation[];
}

/** Client -> server: this client's updated cursor / selection. */
export interface PresenceMessage {
  kind: "presence";
  presence: Presence;
}

/** Server -> client: the client's submitted batch was committed. */
export interface AckMessage {
  kind: "ack";
}

/** Server -> client: a remote operation to apply. */
export interface RemoteOpMessage {
  kind: "op";
  op: Operation;
  clientId: number;
}

/** Server -> client: a remote peer's presence changed. */
export interface RemotePresenceMessage {
  kind: "presence";
  presence: Presence;
}

/** Server -> client: a peer disconnected. */
export interface PeerLeftMessage {
  kind: "leave";
  clientId: number;
}

export type ClientMessage = SubmitMessage | PresenceMessage;
export type ServerMessage =
  | AckMessage
  | RemoteOpMessage
  | RemotePresenceMessage
  | PeerLeftMessage;

// ============================================================================
// Transport interface
// ============================================================================

/**
 * A bidirectional channel of JSON-serialisable messages. A
 * `CollabClient` needs only this; the concrete channel (WebSocket,
 * BroadcastChannel, a test fake) is swappable.
 */
export interface Transport {
  /** Send a message to the server. */
  send(message: ClientMessage): void;
  /** Register the handler for server messages. */
  onMessage(handler: (message: ServerMessage) => void): void;
  /** Close the channel. */
  close(): void;
}

// ============================================================================
// CollabClient — drives a session + presence from a transport
// ============================================================================

export interface CollabClientOptions {
  /** Called after the document changes (local or remote). */
  onDocumentChange?: () => void;
  /** Called after a remote peer's presence changes. */
  onPresenceChange?: () => void;
}

/**
 * Glue between a `Transport` and a `CollabSession` + `PresenceMap`.
 * Local edits go in through `applyLocal`; remote messages arrive on
 * the transport and are reconciled into the session.
 */
export class CollabClient {
  private readonly session: CollabSession;
  private readonly presence = new PresenceMap();

  constructor(
    private readonly transport: Transport,
    session: CollabSession,
    private readonly options: CollabClientOptions = {},
  ) {
    this.session = session;
    this.transport.onMessage((m) => this.handle(m));
  }

  /** The session's current document. */
  getDocument() {
    return this.session.getDocument();
  }

  /** Remote peers' presence. */
  getPeers(): Presence[] {
    return this.presence.all();
  }

  /**
   * Apply a local edit: update the session optimistically, keep
   * remote cursors anchored, and flush the queue to the server.
   */
  applyLocal(op: Operation): void {
    this.session.applyLocal(op);
    this.presence.applyOperation(op);
    this.options.onDocumentChange?.();
    this.flush();
  }

  /** Broadcast this client's cursor / selection. */
  setLocalPresence(presence: Presence): void {
    this.transport.send({ kind: "presence", presence });
  }

  /** Send the next queued batch if the channel is free. */
  private flush(): void {
    const batch = this.session.flush();
    if (!batch) return;
    this.transport.send({
      kind: "submit",
      revision: batch.revision,
      clientId: batch.clientId,
      ops: batch.ops,
    });
  }

  /** Handle one server message. */
  private handle(message: ServerMessage): void {
    switch (message.kind) {
      case "ack":
        this.session.ack();
        // A queued edit may have arrived while we waited — send it.
        this.flush();
        break;
      case "op":
        this.session.receive(message.op, message.clientId);
        this.presence.applyOperation(message.op);
        this.options.onDocumentChange?.();
        break;
      case "presence":
        this.presence.set(message.presence);
        this.options.onPresenceChange?.();
        break;
      case "leave":
        this.presence.remove(message.clientId);
        this.options.onPresenceChange?.();
        break;
    }
  }

  /** Close the underlying transport. */
  close(): void {
    this.transport.close();
  }
}

// ============================================================================
// WebSocketTransport
// ============================================================================

/**
 * A `Transport` over a browser `WebSocket`. Messages are JSON. This
 * adapter is intentionally thin — all reconciliation lives in
 * `CollabClient` / `CollabSession`. Its runtime needs a server
 * speaking the same protocol, so it is type-checked here and verified
 * end to end in a deployment.
 */
export class WebSocketTransport implements Transport {
  private readonly socket: WebSocket;
  private handler: ((message: ServerMessage) => void) | null = null;
  /** Messages queued while the socket is still opening. */
  private readonly outbox: ClientMessage[] = [];

  constructor(url: string) {
    this.socket = new WebSocket(url);
    this.socket.addEventListener("open", () => {
      for (const m of this.outbox) this.socket.send(JSON.stringify(m));
      this.outbox.length = 0;
    });
    this.socket.addEventListener("message", (event: MessageEvent) => {
      if (!this.handler) return;
      try {
        this.handler(JSON.parse(String(event.data)) as ServerMessage);
      } catch {
        // Ignore malformed frames.
      }
    });
  }

  send(message: ClientMessage): void {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    } else {
      this.outbox.push(message);
    }
  }

  onMessage(handler: (message: ServerMessage) => void): void {
    this.handler = handler;
  }

  close(): void {
    this.socket.close();
  }
}
