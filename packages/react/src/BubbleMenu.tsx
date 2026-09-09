/**
 * BubbleMenu — a formatting popover that appears above the current
 * text selection. Covers the §13 "bubble menu" requirement and the
 * §19 "selected text" context menu.
 *
 * It tracks the live DOM selection: whenever there's a non-empty range
 * inside the editor, the menu shows above it; when the selection
 * collapses or moves outside, it hides.
 *
 * Default contents are the inline-formatting buttons (bold, italic,
 * underline, strike, link). Pass children to customise — the buttons
 * read the editor from context just like in the main toolbar.
 */

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useEditorContext } from "./Editor.js";
import { Floating } from "./Floating.js";
import {
  BoldButton,
  ItalicButton,
  UnderlineButton,
  StrikeButton,
  LinkButton,
} from "./Toolbar.js";

export interface BubbleMenuProps {
  /** Custom contents. Defaults to bold / italic / underline / strike / link. */
  children?: ReactNode;
}

export function BubbleMenu({ children }: BubbleMenuProps) {
  const editor = useEditorContext();
  const [anchor, setAnchor] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!editor) return;

    const update = () => {
      const el = editor.element;
      // Hide in read-only mode — there's nothing to format.
      if (!el || el.getAttribute("contenteditable") === "false") {
        setAnchor(null);
        return;
      }
      if (typeof window === "undefined") return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        setAnchor(null);
        return;
      }
      const range = sel.getRangeAt(0);
      // The selection must live inside this editor's surface.
      if (!el.contains(range.commonAncestorContainer)) {
        setAnchor(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      // A zero-size rect means there's nothing real to anchor to.
      if (rect.width === 0 && rect.height === 0) {
        setAnchor(null);
        return;
      }
      setAnchor(rect);
    };

    const offSel = editor.on("selectionUpdate", update);
    // `selectionchange` catches drag-selection while the mouse moves;
    // the editor's own selectionUpdate catches programmatic changes.
    document.addEventListener("selectionchange", update);
    return () => {
      offSel?.();
      document.removeEventListener("selectionchange", update);
    };
  }, [editor]);

  if (!editor) return null;

  return (
    <Floating
      anchor={anchor}
      open={anchor !== null}
      placement="top"
      className="smeditor-bubble-menu"
    >
      {children ?? (
        <>
          <BoldButton />
          <ItalicButton />
          <UnderlineButton />
          <StrikeButton />
          <LinkButton />
        </>
      )}
    </Floating>
  );
}
