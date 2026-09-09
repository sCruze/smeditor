/**
 * Tests for the transport layer — CollabClient driven by a fake
 * in-memory Transport. WebSocketTransport itself needs a real server,
 * so it is type-checked but not exercised here.
 */

import { describe, it, expect } from "vitest";
import {
  CollabClient,
  CollabSession,
  transformOperation,
  type Transport,
  type ClientMessage,
  type ServerMessage,
  type Operation,
  type Presence,
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

/** A fake transport: records sent messages, lets the test push replies. */
class FakeTransport implements Transport {
  sent: ClientMessage[] = [];
  private handler: ((m: ServerMessage) => void) | null = null;
  closed = false;

  send(message: ClientMessage): void {
    this.sent.push(message);
  }
  onMessage(handler: (m: ServerMessage) => void): void {
    this.handler = handler;
  }
  close(): void {
    this.closed = true;
  }
  /** Simulate a server message arriving. */
  deliver(message: ServerMessage): void {
    this.handler?.(message);
  }
}

describe("CollabClient — local edits", () => {
  it("submits a batch when a local edit is applied", () => {
    const t = new FakeTransport();
    const client = new CollabClient(t, new CollabSession(docOf("hi"), 1));
    client.applyLocal(insert(2, "!"));
    expect(blockText(client.getDocument())).toBe("hi!");
    expect(t.sent).toHaveLength(1);
    expect(t.sent[0].kind).toBe("submit");
  });

  it("flushes a queued edit after an ack", () => {
    const t = new FakeTransport();
    const client = new CollabClient(t, new CollabSession(docOf("hi"), 1));
    client.applyLocal(insert(2, "!")); // submitted
    client.applyLocal(insert(3, "?")); // queued behind the in-flight batch
    expect(t.sent).toHaveLength(1);
    t.deliver({ kind: "ack" }); // first batch committed -> flush the queue
    expect(t.sent).toHaveLength(2);
    expect(t.sent[1].kind).toBe("submit");
  });
});

describe("CollabClient — remote messages", () => {
  it("applies a remote operation", () => {
    const t = new FakeTransport();
    const client = new CollabClient(t, new CollabSession(docOf("hi"), 2));
    t.deliver({ kind: "op", op: insert(2, " there"), clientId: 1 });
    expect(blockText(client.getDocument())).toBe("hi there");
  });

  it("tracks and drops remote peers' presence", () => {
    const t = new FakeTransport();
    const client = new CollabClient(t, new CollabSession(docOf("hi"), 2));
    const presence: Presence = {
      clientId: 1,
      name: "Ada",
      anchor: { path: [0], offset: 1 },
      head: { path: [0], offset: 1 },
    };
    t.deliver({ kind: "presence", presence });
    expect(client.getPeers()).toHaveLength(1);
    expect(client.getPeers()[0].name).toBe("Ada");

    t.deliver({ kind: "leave", clientId: 1 });
    expect(client.getPeers()).toHaveLength(0);
  });

  it("keeps a remote cursor anchored across a local edit", () => {
    const t = new FakeTransport();
    const client = new CollabClient(t, new CollabSession(docOf("hello"), 2));
    t.deliver({
      kind: "presence",
      presence: {
        clientId: 1,
        anchor: { path: [0], offset: 5 },
        head: { path: [0], offset: 5 },
      },
    });
    // Local insert at the start shifts the remote cursor right.
    client.applyLocal(insert(0, "XX"));
    expect(client.getPeers()[0].anchor.offset).toBe(7);
  });
});

describe("CollabClient — convergence over transports", () => {
  it("two clients relayed through an OT server converge", () => {
    // A faithful relay: a server-side log with operational transform,
    // exactly what MemoryHub / a real backend does. Submitted ops are
    // transformed past everything committed since the client's base
    // revision before being broadcast.
    const ta = new FakeTransport();
    const tb = new FakeTransport();
    const a = new CollabClient(ta, new CollabSession(docOf("AB"), 1));
    const b = new CollabClient(tb, new CollabSession(docOf("AB"), 2));

    const log: { op: Operation; clientId: number }[] = [];
    const ports: Record<number, FakeTransport> = { 1: ta, 2: tb };

    const commit = (sub: Extract<ClientMessage, { kind: "submit" }>) => {
      const concurrent = log.slice(sub.revision);
      for (const raw of sub.ops) {
        let op = raw;
        for (const c of concurrent) {
          const priority = sub.clientId < c.clientId ? "left" : "right";
          op = transformOperation(op, c.op, priority);
        }
        log.push({ op, clientId: sub.clientId });
        for (const [id, port] of Object.entries(ports)) {
          if (Number(id) !== sub.clientId) {
            port.deliver({ kind: "op", op, clientId: sub.clientId });
          }
        }
      }
      ports[sub.clientId].deliver({ kind: "ack" });
    };

    a.applyLocal(insert(0, "1"));
    b.applyLocal(insert(2, "2"));

    commit(ta.sent[0] as Extract<ClientMessage, { kind: "submit" }>);
    commit(tb.sent[0] as Extract<ClientMessage, { kind: "submit" }>);

    expect(blockText(a.getDocument())).toBe(blockText(b.getDocument()));
    expect(blockText(a.getDocument())).toBe("1AB2");
  });

  it("close() closes the transport", () => {
    const t = new FakeTransport();
    const client = new CollabClient(t, new CollabSession(docOf(""), 1));
    client.close();
    expect(t.closed).toBe(true);
  });
});
