/**
 * Floating — a tiny positioning primitive for popovers anchored to a
 * point or rectangle in the document.
 *
 * Why hand-rolled instead of floating-ui / popper: the editor only
 * needs two placements (above a text selection, below the caret) with
 * simple viewport-edge flipping. A full positioning library would be
 * more dependency surface than the feature warrants. This is ~60 lines
 * and does exactly what the bubble and slash menus need.
 *
 * The floating element is `position: fixed`, so the anchor rectangle
 * must be in viewport coordinates — which is exactly what
 * `Range.getBoundingClientRect()` and `Element.getBoundingClientRect()`
 * return. No scroll-offset math required.
 */

import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export type FloatingPlacement = "top" | "bottom";

export interface FloatingProps {
  /** Anchor rectangle in viewport coords (from getBoundingClientRect). */
  anchor: DOMRect | null;
  /** Preferred side. Flips to the other side if it would overflow. */
  placement?: FloatingPlacement;
  /** Gap between the anchor and the floating element, in px. */
  offset?: number;
  /** Whether the floating element is shown. */
  open: boolean;
  className?: string;
  children: ReactNode;
}

const VIEWPORT_MARGIN = 8;

export function Floating({
  anchor,
  placement = "top",
  offset = 8,
  open,
  className,
  children,
}: FloatingProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Position is computed in a layout effect — after the element has
  // rendered (so we can measure it) but before the browser paints (so
  // there's no visible jump). Until the first measurement the element
  // is parked off-screen at opacity 0.
  useLayoutEffect(() => {
    if (!open || !anchor || !ref.current) {
      setPos(null);
      return;
    }
    const menu = ref.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Horizontal: center on the anchor, clamped to the viewport.
    let left = anchor.left + anchor.width / 2 - menu.width / 2;
    left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(left, vw - menu.width - VIEWPORT_MARGIN),
    );

    // Vertical: preferred side, flip if it would overflow.
    let top: number;
    if (placement === "top") {
      top = anchor.top - menu.height - offset;
      if (top < VIEWPORT_MARGIN) top = anchor.bottom + offset;
    } else {
      top = anchor.bottom + offset;
      if (top + menu.height > vh - VIEWPORT_MARGIN) {
        top = anchor.top - menu.height - offset;
      }
    }
    setPos({ top, left });
  }, [open, anchor, placement, offset]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className={["smeditor-floating", className].filter(Boolean).join(" ")}
      // mousedown-preventDefault keeps the editor selection alive when
      // the user clicks a button inside the floating element.
      onMouseDown={(e) => e.preventDefault()}
      style={{
        position: "fixed",
        top: pos ? pos.top : -9999,
        left: pos ? pos.left : -9999,
        opacity: pos ? 1 : 0,
        zIndex: 1000,
      }}
      role="menu"
    >
      {children}
    </div>
  );
}
