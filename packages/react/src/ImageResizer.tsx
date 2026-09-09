/**
 * ImageResizer — a drag-handle overlay for resizing the selected
 * image. Covers the resize part of §9.
 *
 * Render it once inside `<EditorProvider>`. When the caret enters an
 * image block it positions a fixed overlay over the `<img>` with four
 * corner handles. Dragging a handle live-previews the new width by
 * setting `img.style.width`; on release it dispatches
 * `updateImageAttrs({ width })` so the change lands in the document
 * model (and the history).
 *
 * Width only — height follows from the image's aspect ratio because
 * the theme sets `height: auto` on `.smeditor-image`.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditorContext } from "./Editor.js";

const MIN_WIDTH = 48;
const MAX_WIDTH = 2000;

type Corner = "nw" | "ne" | "sw" | "se";

interface DragState {
  corner: Corner;
  startX: number;
  startWidth: number;
  img: HTMLImageElement;
}

export function ImageResizer() {
  const editor = useEditorContext();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const dragRef = useRef<DragState | null>(null);

  // Locate the <img> for the image block under the caret.
  const findImage = useCallback((): HTMLImageElement | null => {
    if (!editor) return null;
    const el = editor.element;
    if (!el || el.getAttribute("contenteditable") === "false") return null;
    if (!editor.isActive("image")) return null;
    const idx = editor.getSelection()?.anchor.path[0] ?? -1;
    if (idx < 0) return null;
    const node = el.children[idx];
    if (!node) return null;
    // A captioned image renders as a <figure> wrapping the <img>, so the
    // top-level block child isn't the image itself — descend into it.
    const img =
      node instanceof HTMLImageElement ? node : node.querySelector("img");
    return img instanceof HTMLImageElement ? img : null;
  }, [editor]);

  const refresh = useCallback(() => {
    const img = findImage();
    setRect(img ? img.getBoundingClientRect() : null);
  }, [findImage]);

  // Track which image is selected, and keep the overlay aligned on
  // scroll / resize.
  useEffect(() => {
    if (!editor) return;
    refresh();
    const offSel = editor.on("selectionUpdate", refresh);
    const offUpd = editor.on("update", refresh);
    window.addEventListener("scroll", refresh, true);
    window.addEventListener("resize", refresh);
    return () => {
      offSel?.();
      offUpd?.();
      window.removeEventListener("scroll", refresh, true);
      window.removeEventListener("resize", refresh);
    };
  }, [editor, refresh]);

  // Pointer drag — module-level listeners so the drag continues even
  // if the pointer leaves the handle.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      // West handles grow the image as the pointer moves left.
      const signed = drag.corner === "nw" || drag.corner === "sw" ? -dx : dx;
      const next = Math.max(
        MIN_WIDTH,
        Math.min(MAX_WIDTH, drag.startWidth + signed),
      );
      drag.img.style.width = `${Math.round(next)}px`;
      setRect(drag.img.getBoundingClientRect());
    };
    const onUp = () => {
      const drag = dragRef.current;
      if (!drag || !editor) return;
      const finalWidth = drag.img.getBoundingClientRect().width;
      dragRef.current = null;
      document.body.style.removeProperty("cursor");
      // Persist into the document model.
      editor.commands.updateImageAttrs?.({ width: Math.round(finalWidth) });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [editor]);

  if (!editor || !rect) return null;

  const startDrag = (corner: Corner) => (e: React.PointerEvent) => {
    const img = findImage();
    if (!img) return;
    e.preventDefault();
    dragRef.current = {
      corner,
      startX: e.clientX,
      startWidth: img.getBoundingClientRect().width,
      img,
    };
    document.body.style.cursor =
      corner === "ne" || corner === "sw" ? "nesw-resize" : "nwse-resize";
  };

  const corners: Corner[] = ["nw", "ne", "sw", "se"];

  return (
    <div
      className="smeditor-image-resizer"
      style={{
        position: "fixed",
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        pointerEvents: "none",
        zIndex: 900,
      }}
    >
      {corners.map((corner) => (
        <span
          key={corner}
          className={`smeditor-image-resizer__handle is-${corner}`}
          style={{ pointerEvents: "auto" }}
          onPointerDown={startDrag(corner)}
        />
      ))}
    </div>
  );
}
