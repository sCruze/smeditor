/**
 * TableOfContents — a live outline of the document's headings.
 *
 * It walks the document for `heading` blocks (recursing into containers
 * so headings nested in blockquotes / list items still show up),
 * collecting each heading's level, visible text and document path. The
 * list refreshes on every editor update.
 *
 * Clicking an entry moves the caret to the start of that heading and
 * focuses the editor, then calls the optional `onNavigate` callback with
 * the heading's path — useful for hosts that scroll the surface.
 */

import { useEffect, useMemo, useState } from "react";
import type { EditorInstance, DocumentNode } from "@smeditor/core";
import { blockVisibleText } from "@smeditor/core";

export interface TableOfContentsProps {
  /** The editor whose headings are listed. Renders nothing while null. */
  editor: EditorInstance | null;
  className?: string;
  /** Called after navigating to a heading, with its document path. */
  onNavigate?: (path: number[]) => void;
}

interface HeadingEntry {
  level: number;
  text: string;
  path: number[];
}

/** Recursively collect headings in document order. */
function collectHeadings(
  blocks: DocumentNode[] | undefined,
  parentPath: number[],
  out: HeadingEntry[],
): void {
  if (!blocks) return;
  blocks.forEach((block, index) => {
    const path = [...parentPath, index];
    if (block.type === "heading") {
      const level = Number(block.attrs?.level ?? 1) || 1;
      out.push({ level, text: blockVisibleText(block), path });
    }
    if (block.content) collectHeadings(block.content, path, out);
  });
}

export function TableOfContents({
  editor,
  className,
  onNavigate,
}: TableOfContentsProps) {
  // Bumped on document updates so the outline re-derives.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!editor) return;
    const bump = () => setVersion((v) => v + 1);
    const off = editor.on("update", bump);
    return () => off?.();
  }, [editor]);

  const headings = useMemo<HeadingEntry[]>(() => {
    if (!editor) return [];
    const out: HeadingEntry[] = [];
    collectHeadings(editor.getJSON().content, [], out);
    return out;
    // `version` forces a refresh on edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, version]);

  if (!editor) return null;

  const navigate = (path: number[]) => {
    editor.setSelection({
      anchor: { path, offset: 0 },
      head: { path, offset: 0 },
    });
    editor.focus();
    onNavigate?.(path);
  };

  if (headings.length === 0) {
    return (
      <nav
        className={["smeditor-toc", className].filter(Boolean).join(" ")}
        aria-label="Table of contents"
      >
        <p className="smeditor-toc__empty">No headings yet.</p>
      </nav>
    );
  }

  return (
    <nav
      className={["smeditor-toc", className].filter(Boolean).join(" ")}
      aria-label="Table of contents"
    >
      <ul className="smeditor-toc__list">
        {headings.map((heading, i) => (
          <li
            key={`${heading.path.join("-")}-${i}`}
            className={`smeditor-toc__item is-level-${heading.level}`}
            style={{ paddingInlineStart: `${(heading.level - 1) * 12}px` }}
          >
            <button
              type="button"
              className="smeditor-toc__link"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => navigate(heading.path)}
            >
              {heading.text || "Untitled heading"}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
