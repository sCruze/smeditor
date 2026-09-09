/**
 * RemoteCursors — an overlay that renders collaborators' carets.
 *
 * Given the peers from a collaboration `PresenceMap` (each a
 * `clientId`, optional name / colour, and a selection), this draws a
 * coloured caret with a name label at every peer's cursor position.
 *
 * Positions come from the editor's `coordsAtPoint`, recomputed on
 * every editor update so the carets track edits. Render it inside
 * `<EditorProvider>`, as a sibling of the editable surface, in a
 * positioned container.
 */

import { useEffect, useState } from "react";
import { useEditorContext } from "./Editor.js";

/** One endpoint of a peer's selection. */
interface CursorPoint {
  path: number[];
  offset: number;
}

/** A collaborator's presence — matches @smeditor/collab's Presence. */
export interface RemotePeer {
  clientId: number;
  name?: string;
  color?: string;
  anchor: CursorPoint;
  head: CursorPoint;
}

export interface RemoteCursorsProps {
  /** The peers to draw, e.g. from `collabClient.getPeers()`. */
  peers: RemotePeer[];
}

interface PlacedCursor {
  clientId: number;
  name: string;
  color: string;
  top: number;
  left: number;
  height: number;
}

const FALLBACK_COLORS = [
  "#e8590c",
  "#1971c2",
  "#2f9e44",
  "#9c36b5",
  "#c2255c",
];

function colorFor(peer: RemotePeer): string {
  if (peer.color) return peer.color;
  return FALLBACK_COLORS[peer.clientId % FALLBACK_COLORS.length];
}

export function RemoteCursors({ peers }: RemoteCursorsProps) {
  const editor = useEditorContext();
  const [cursors, setCursors] = useState<PlacedCursor[]>([]);

  useEffect(() => {
    if (!editor) return;

    const place = () => {
      const next: PlacedCursor[] = [];
      for (const peer of peers) {
        // Draw the caret at the selection head.
        const coords = editor.coordsAtPoint(peer.head);
        if (!coords) continue;
        next.push({
          clientId: peer.clientId,
          name: peer.name ?? `User ${peer.clientId}`,
          color: colorFor(peer),
          top: coords.top,
          left: coords.left,
          height: coords.height,
        });
      }
      setCursors(next);
    };

    place();
    const off = editor.on("update", place);
    return () => off?.();
  }, [editor, peers]);

  if (!editor) return null;

  return (
    <div className="smeditor-remote-cursors" aria-hidden="true">
      {cursors.map((c) => (
        <div
          key={c.clientId}
          className="smeditor-remote-cursor"
          style={{ top: c.top, left: c.left, height: c.height }}
        >
          <span
            className="smeditor-remote-cursor__caret"
            style={{ background: c.color }}
          />
          <span
            className="smeditor-remote-cursor__label"
            style={{ background: c.color }}
          >
            {c.name}
          </span>
        </div>
      ))}
    </div>
  );
}
