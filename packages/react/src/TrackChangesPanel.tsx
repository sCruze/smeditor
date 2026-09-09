/**
 * TrackChangesPanel — a review panel for tracked changes.
 *
 * Lists every insertion / deletion in the document with its author,
 * and offers accept / reject per change plus accept-all / reject-all.
 * Render it anywhere inside `<EditorProvider>`.
 *
 * The change list is read from the track-changes extension's
 * `getChanges`; accepting or rejecting dispatches the matching
 * command. The panel re-reads on every editor update so it stays in
 * sync as changes are resolved.
 */

import { useEffect, useState } from "react";
import { useEditorContext } from "./Editor.js";

interface PanelChange {
  type: "insertion" | "deletion";
  author: string | null;
  text: string;
}

export interface TrackChangesPanelProps {
  /** Optional heading shown above the list. */
  title?: string;
}

export function TrackChangesPanel({
  title = "Tracked changes",
}: TrackChangesPanelProps) {
  const editor = useEditorContext();
  const [changes, setChanges] = useState<PanelChange[]>([]);

  // Re-read the change list whenever the document updates.
  useEffect(() => {
    if (!editor) return;
    const read = () => {
      setChanges(collectChanges(editor.getJSON()));
    };
    read();
    const off = editor.on("update", read);
    return () => off?.();
  }, [editor]);

  if (!editor) return null;

  const accept = (i: number) => editor.commands.acceptChange?.({ index: i });
  const reject = (i: number) => editor.commands.rejectChange?.({ index: i });

  return (
    <div className="smeditor-track-panel">
      <div className="smeditor-track-panel__head">
        <span className="smeditor-track-panel__title">{title}</span>
        <span className="smeditor-track-panel__count">{changes.length}</span>
      </div>

      {changes.length === 0 ? (
        <p className="smeditor-track-panel__empty">No tracked changes.</p>
      ) : (
        <>
          <ul className="smeditor-track-panel__list">
            {changes.map((c, i) => (
              <li
                key={i}
                className={`smeditor-track-item is-${c.type}`}
              >
                <div className="smeditor-track-item__meta">
                  <span className="smeditor-track-item__type">
                    {c.type === "insertion" ? "Inserted" : "Deleted"}
                  </span>
                  {c.author && (
                    <span className="smeditor-track-item__author">
                      {c.author}
                    </span>
                  )}
                </div>
                <div className="smeditor-track-item__text">{c.text}</div>
                <div className="smeditor-track-item__actions">
                  <button type="button" onClick={() => accept(i)}>
                    Accept
                  </button>
                  <button type="button" onClick={() => reject(i)}>
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="smeditor-track-panel__bulk">
            <button
              type="button"
              onClick={() => editor.commands.acceptAllChanges?.()}
            >
              Accept all
            </button>
            <button
              type="button"
              onClick={() => editor.commands.rejectAllChanges?.()}
            >
              Reject all
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** Walk a document JSON collecting insertion / deletion marks. */
function collectChanges(doc: {
  content?: unknown[];
}): PanelChange[] {
  const out: PanelChange[] = [];
  const walk = (node: Record<string, unknown>) => {
    const marks = node.marks as
      | { type: string; attrs?: Record<string, unknown> }[]
      | undefined;
    if (node.type === "text" && marks) {
      for (const m of marks) {
        if (m.type === "insertion" || m.type === "deletion") {
          out.push({
            type: m.type,
            author: (m.attrs?.author as string) ?? null,
            text: (node.text as string) ?? "",
          });
        }
      }
    }
    const content = node.content as Record<string, unknown>[] | undefined;
    content?.forEach(walk);
  };
  (doc.content as Record<string, unknown>[] | undefined)?.forEach(walk);
  return out;
}
