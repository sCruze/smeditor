/**
 * History (undo/redo).
 *
 * Two stacks of document snapshots. Each non-history transaction pushes
 * the previous state to the undo stack and clears the redo stack.
 *
 * For MVP we snapshot full docs; this is O(doc size) per edit but simple
 * and bulletproof. A future optimization is to store inverse operations.
 */

import type { DocumentJSON, EditorSelection } from "./types.js";

export interface HistoryEntry {
  doc: DocumentJSON;
  selection: EditorSelection | null;
}

export interface HistoryOptions {
  /** Max entries kept on each stack. */
  limit?: number;
  /**
   * Window (ms) within which consecutive edits sharing the same
   * `coalesceKey` collapse into a single undo step. Set to 0 to disable
   * coalescing (every edit is its own step). Defaults to 500ms.
   */
  coalesceMs?: number;
}

export class History {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private readonly limit: number;
  private readonly coalesceMs: number;
  private lastRecordTime = 0;
  private lastCoalesceKey: string | null = null;

  constructor(options: HistoryOptions = {}) {
    this.limit = options.limit ?? 100;
    this.coalesceMs = options.coalesceMs ?? 500;
  }

  /**
   * Record the *previous* state before a change is applied.
   *
   * When `coalesceKey` is given and matches the previous record within
   * the coalesce window, the intermediate snapshot is dropped — a run
   * of typing in one block becomes one undo step instead of one per
   * keystroke. Structural edits and formatting commands pass no key, so
   * each is its own step.
   */
  record(
    entry: HistoryEntry,
    coalesceKey?: string,
    now: number = Date.now(),
  ): void {
    if (
      coalesceKey != null &&
      this.coalesceMs > 0 &&
      coalesceKey === this.lastCoalesceKey &&
      now - this.lastRecordTime < this.coalesceMs &&
      this.undoStack.length > 0
    ) {
      // Same continuous edit run — keep the pre-run snapshot, just
      // refresh the timer. A new edit still invalidates the redo branch.
      this.lastRecordTime = now;
      this.redoStack.length = 0;
      return;
    }
    this.undoStack.push(entry);
    if (this.undoStack.length > this.limit) {
      this.undoStack.shift();
    }
    // Any new edit invalidates the redo branch.
    this.redoStack.length = 0;
    this.lastCoalesceKey = coalesceKey ?? null;
    this.lastRecordTime = now;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Pop the most recent undo entry and push the *current* state onto
   * the redo stack. Caller must apply the returned entry.
   */
  undo(current: HistoryEntry): HistoryEntry | null {
    const entry = this.undoStack.pop();
    if (!entry) return null;
    this.redoStack.push(current);
    if (this.redoStack.length > this.limit) {
      this.redoStack.shift();
    }
    // After an undo, the next edit must start a fresh step rather than
    // coalescing onto the snapshot we just restored.
    this.lastCoalesceKey = null;
    return entry;
  }

  redo(current: HistoryEntry): HistoryEntry | null {
    const entry = this.redoStack.pop();
    if (!entry) return null;
    this.undoStack.push(current);
    if (this.undoStack.length > this.limit) {
      this.undoStack.shift();
    }
    this.lastCoalesceKey = null;
    return entry;
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.lastCoalesceKey = null;
  }
}
