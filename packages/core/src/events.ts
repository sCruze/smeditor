/**
 * Typed event emitter for the editor.
 *
 * Internal storage is a `Map<string, Set<Function>>` — the generic
 * `on(...)` signature gives us type safety at the call site, while the
 * untyped Map keeps TS happy with the mapped-type assignment problem.
 *
 * `on(...)` returns an unsubscribe function (same pattern as
 * EventTarget.removeEventListener but without the awkwardness).
 */

import type { EditorEventName, EditorEventPayload } from "./types.js";

type AnyHandler = (payload: unknown) => void;

export class EventEmitter {
  private readonly handlers = new Map<EditorEventName, Set<AnyHandler>>();

  on<E extends EditorEventName>(
    event: E,
    handler: (payload: EditorEventPayload[E]) => void,
  ): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    const wrapped = handler as AnyHandler;
    set.add(wrapped);
    return () => {
      set!.delete(wrapped);
    };
  }

  emit<E extends EditorEventName>(
    event: E,
    payload: EditorEventPayload[E],
  ): void {
    const set = this.handlers.get(event);
    if (!set || set.size === 0) return;
    // Snapshot — handlers may unsubscribe themselves during dispatch.
    for (const h of Array.from(set)) {
      try {
        h(payload as unknown);
      } catch (err) {
        // Never let a misbehaving listener kill the editor.
         
        console.error("[smeditor] event handler threw:", err);
      }
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}
