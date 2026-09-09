/**
 * EmojiPicker — a controlled popover for inserting emoji and special
 * characters, positioned near the caret on the same `Floating`
 * primitive the mention / slash menus use.
 *
 * The host controls visibility with `open` / `onClose`. While open, the
 * popover anchors to the caret (via `editor.coordsAtPoint`) and shows
 * two sections — Emoji and Symbols — each a grid of buttons. Clicking a
 * glyph inserts it through the emoji extension's `insertEmoji` command
 * (which accepts a raw character) and then closes the popover.
 *
 * If `insertEmoji` isn't registered the picker renders nothing — the
 * emoji extension owns the insertion behaviour.
 *
 * Keyboard: Escape closes.
 */

import { useEffect, useState } from "react";
import type { EditorInstance } from "@smeditor/core";
import { Floating } from "./Floating.js";

interface Glyph {
  char: string;
  name: string;
}

const EMOJI: Glyph[] = [
  { char: "😀", name: "Grinning face" },
  { char: "😄", name: "Grinning face with smiling eyes" },
  { char: "😁", name: "Beaming face" },
  { char: "😂", name: "Face with tears of joy" },
  { char: "🤣", name: "Rolling on the floor laughing" },
  { char: "😊", name: "Smiling face with smiling eyes" },
  { char: "😇", name: "Smiling face with halo" },
  { char: "🙂", name: "Slightly smiling face" },
  { char: "😉", name: "Winking face" },
  { char: "😍", name: "Smiling face with heart-eyes" },
  { char: "😘", name: "Face blowing a kiss" },
  { char: "😜", name: "Winking face with tongue" },
  { char: "🤔", name: "Thinking face" },
  { char: "🤗", name: "Hugging face" },
  { char: "😎", name: "Smiling face with sunglasses" },
  { char: "😢", name: "Crying face" },
  { char: "😭", name: "Loudly crying face" },
  { char: "😡", name: "Pouting face" },
  { char: "😱", name: "Face screaming in fear" },
  { char: "🥳", name: "Partying face" },
  { char: "😴", name: "Sleeping face" },
  { char: "🤯", name: "Exploding head" },
  { char: "👍", name: "Thumbs up" },
  { char: "👎", name: "Thumbs down" },
  { char: "👏", name: "Clapping hands" },
  { char: "🙌", name: "Raising hands" },
  { char: "🙏", name: "Folded hands" },
  { char: "👌", name: "OK hand" },
  { char: "✌️", name: "Victory hand" },
  { char: "🤝", name: "Handshake" },
  { char: "💪", name: "Flexed biceps" },
  { char: "🔥", name: "Fire" },
  { char: "✨", name: "Sparkles" },
  { char: "🎉", name: "Party popper" },
  { char: "❤️", name: "Red heart" },
  { char: "💯", name: "Hundred points" },
  { char: "⭐", name: "Star" },
  { char: "✅", name: "Check mark button" },
  { char: "❌", name: "Cross mark" },
  { char: "🚀", name: "Rocket" },
];

const SYMBOLS: Glyph[] = [
  { char: "©", name: "Copyright sign" },
  { char: "®", name: "Registered sign" },
  { char: "™", name: "Trade mark sign" },
  { char: "§", name: "Section sign" },
  { char: "¶", name: "Pilcrow sign" },
  { char: "†", name: "Dagger" },
  { char: "‡", name: "Double dagger" },
  { char: "•", name: "Bullet" },
  { char: "…", name: "Horizontal ellipsis" },
  { char: "–", name: "En dash" },
  { char: "—", name: "Em dash" },
  { char: "«", name: "Left double angle quote" },
  { char: "»", name: "Right double angle quote" },
  { char: "“", name: "Left double quotation mark" },
  { char: "”", name: "Right double quotation mark" },
  { char: "‘", name: "Left single quotation mark" },
  { char: "’", name: "Right single quotation mark" },
  { char: "±", name: "Plus-minus sign" },
  { char: "×", name: "Multiplication sign" },
  { char: "÷", name: "Division sign" },
  { char: "≠", name: "Not equal to" },
  { char: "≤", name: "Less than or equal to" },
  { char: "≥", name: "Greater than or equal to" },
  { char: "→", name: "Rightwards arrow" },
  { char: "←", name: "Leftwards arrow" },
  { char: "↔", name: "Left right arrow" },
  { char: "⇒", name: "Rightwards double arrow" },
  { char: "∞", name: "Infinity" },
  { char: "°", name: "Degree sign" },
  { char: "µ", name: "Micro sign" },
  { char: "½", name: "One half" },
  { char: "¼", name: "One quarter" },
  { char: "¾", name: "Three quarters" },
  { char: "€", name: "Euro sign" },
];

export interface EmojiPickerProps {
  /** The editor to insert into. Renders nothing while null. */
  editor: EditorInstance | null;
  /** Controlled visibility. */
  open?: boolean;
  /** Called when the picker should close (insert, Escape). */
  onClose?: () => void;
  className?: string;
}

/** True when the emoji extension has registered `insertEmoji`. */
function hasInsertEmoji(editor: EditorInstance | null): boolean {
  return typeof editor?.commands.insertEmoji === "function";
}

/** Build a viewport-coords anchor rect from the caret position. */
function caretAnchor(editor: EditorInstance | null): DOMRect | null {
  if (!editor || typeof DOMRect === "undefined") return null;
  const sel = editor.getSelection();
  if (!sel) return null;
  const coords = editor.coordsAtPoint(sel.head);
  if (!coords) return null;
  return new DOMRect(coords.left, coords.top, 0, coords.height);
}

function GlyphGrid({
  glyphs,
  onPick,
}: {
  glyphs: Glyph[];
  onPick: (char: string) => void;
}) {
  return (
    <div className="smeditor-emoji-picker__grid" role="group">
      {glyphs.map((g) => (
        <button
          key={g.char}
          type="button"
          className="smeditor-emoji-picker__glyph"
          title={g.name}
          aria-label={g.name}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(g.char)}
        >
          {g.char}
        </button>
      ))}
    </div>
  );
}

export function EmojiPicker({
  editor,
  open = false,
  onClose,
  className,
}: EmojiPickerProps) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);

  // Re-anchor to the caret whenever the picker opens.
  useEffect(() => {
    if (!open || !editor) {
      setAnchor(null);
      return;
    }
    setAnchor(caretAnchor(editor));
  }, [open, editor]);

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!editor || !hasInsertEmoji(editor)) return null;

  const pick = (char: string) => {
    editor.commands.insertEmoji?.(char);
    onClose?.();
  };

  return (
    <Floating
      anchor={anchor}
      open={open}
      placement="bottom"
      className={["smeditor-emoji-picker", className]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="smeditor-emoji-picker__section">
        <div className="smeditor-emoji-picker__heading">Emoji</div>
        <GlyphGrid glyphs={EMOJI} onPick={pick} />
      </div>
      <div className="smeditor-emoji-picker__section">
        <div className="smeditor-emoji-picker__heading">Symbols</div>
        <GlyphGrid glyphs={SYMBOLS} onPick={pick} />
      </div>
    </Floating>
  );
}
