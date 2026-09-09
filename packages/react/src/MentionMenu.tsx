/**
 * MentionMenu — type `@` to open a candidate picker. The §14 mention
 * UI, built the same way as SlashMenu: it watches the document for a
 * trailing `@query` and shows a filtered list anchored to the caret.
 *
 * Candidates come from the host via `items` — the editor doesn't know
 * who can be mentioned. Picking one calls `insertMention`, which
 * replaces the `@query` with a mention node.
 *
 * Keyboard: ArrowUp / ArrowDown move the highlight, Enter inserts the
 * highlighted candidate, Escape closes — the keydown handler runs in
 * the capture phase so Enter doesn't also split the block.
 */

import { useEffect, useMemo, useState } from "react";
import { getBlockText } from "@smeditor/core";
import { useEditorContext } from "./Editor.js";
import { Floating } from "./Floating.js";

export interface MentionItem {
  /** Stable identifier stored on the mention node. */
  id: string;
  /** Display name — shown in the menu and as the pill text. */
  label: string;
  /** Optional secondary line (e.g. an email or role). */
  hint?: string;
}

export interface MentionMenuProps {
  /** Candidates the user can mention. */
  items: MentionItem[];
}

/** Trailing `@query` in a string — `query` is word characters only. */
const TRAILING_MENTION = /@(\w*)$/;

export function MentionMenu({ items }: MentionMenuProps) {
  const editor = useEditorContext();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [active, setActive] = useState(0);

  // Detect a trailing `@query` before the caret.
  useEffect(() => {
    if (!editor) return;

    const update = () => {
      const el = editor.element;
      if (!el || el.getAttribute("contenteditable") === "false") {
        setOpen(false);
        return;
      }
      const sel = editor.getSelection();
      if (!sel) {
        setOpen(false);
        return;
      }
      const idx = sel.anchor.path[0] ?? 0;
      const block = editor.getJSON().content[idx];
      if (!block) {
        setOpen(false);
        return;
      }
      const text = getBlockText(block);
      const match = TRAILING_MENTION.exec(text);
      if (match) {
        setQuery(match[1]);
        setOpen(true);
        setActive(0);
        if (typeof window !== "undefined") {
          const dsel = window.getSelection();
          if (dsel && dsel.rangeCount > 0) {
            setAnchor(dsel.getRangeAt(0).getBoundingClientRect());
          }
        }
      } else {
        setOpen(false);
      }
    };

    const offUpdate = editor.on("update", update);
    const offSel = editor.on("selectionUpdate", update);
    return () => {
      offUpdate?.();
      offSel?.();
    };
  }, [editor]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return items.slice(0, 8);
    return items
      .filter(
        (it) =>
          it.label.toLowerCase().includes(q) ||
          it.hint?.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [items, query]);

  const insert = (item?: MentionItem) => {
    if (!editor || !item) return;
    editor.commands.insertMention?.({ id: item.id, label: item.label });
    setOpen(false);
  };

  // Keyboard navigation while the menu is open.
  useEffect(() => {
    // Only hijack Enter/Arrow/Escape when the menu is actually visible
    // (it renders only when there are matching candidates). An "@query"
    // matching nobody otherwise silently swallowed those keys.
    if (!editor || !open || filtered.length === 0) return;
    const el = editor.element;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        insert(filtered[active]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    el.addEventListener("keydown", onKey, true);
    return () => el.removeEventListener("keydown", onKey, true);
  }, [editor, open, filtered, active]);

  if (!editor) return null;

  return (
    <Floating
      anchor={anchor}
      open={open && filtered.length > 0}
      placement="bottom"
      className="smeditor-mention-menu"
    >
      {filtered.map((it, i) => (
        <button
          key={it.id}
          type="button"
          role="menuitem"
          className={[
            "smeditor-mention-item",
            i === active ? "is-active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => setActive(i)}
          onClick={() => insert(it)}
        >
          <span className="smeditor-mention-item__label">{it.label}</span>
          {it.hint !== undefined && (
            <span className="smeditor-mention-item__hint">{it.hint}</span>
          )}
        </button>
      ))}
    </Floating>
  );
}
