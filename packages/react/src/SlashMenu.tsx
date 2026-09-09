/**
 * SlashMenu — type "/" at the start of an empty paragraph to open a
 * block-insert menu. Covers the §13 "slash commands" requirement.
 *
 * This is a pure-React feature: it watches the editor's document and
 * selection, and when the current block is a paragraph whose text
 * starts with "/", it opens a filtered command list anchored to the
 * caret. It needs no core changes — the detection is just
 * `getBlockText` plus a string check.
 *
 * Keyboard: ArrowUp / ArrowDown move the highlight, Enter runs the
 * highlighted item, Escape closes. The keydown listener is registered
 * in the capture phase so it runs before the browser's own handling
 * of those keys inside contenteditable.
 */

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { EditorInstance } from "@smeditor/core";
import { getBlockText } from "@smeditor/core";
import { useEditorContext } from "./Editor.js";
import { Floating } from "./Floating.js";
import {
  IconHeading,
  IconBulletList,
  IconOrderedList,
  IconTaskList,
  IconBlockquote,
  IconCodeBlock,
  IconHorizontalRule,
  IconImage,
} from "./icons.js";

export interface SlashItem {
  /** Stable identifier. */
  id: string;
  /** Display label. */
  label: string;
  /** Optional trailing hint, e.g. a shortcut. */
  hint?: string;
  /** Leading icon. */
  icon?: ReactNode;
  /** Extra search terms beyond the label. */
  keywords?: string[];
  /** Run when the item is chosen. The caret block is already cleared. */
  run: (editor: EditorInstance) => void;
}

/** The default block-insert commands. */
export const DEFAULT_SLASH_ITEMS: SlashItem[] = [
  {
    id: "h1",
    label: "Heading 1",
    icon: <IconHeading level={1} />,
    keywords: ["title", "large"],
    run: (e) => e.commands.setHeading?.({ level: 1 }),
  },
  {
    id: "h2",
    label: "Heading 2",
    icon: <IconHeading level={2} />,
    keywords: ["subtitle"],
    run: (e) => e.commands.setHeading?.({ level: 2 }),
  },
  {
    id: "h3",
    label: "Heading 3",
    icon: <IconHeading level={3} />,
    run: (e) => e.commands.setHeading?.({ level: 3 }),
  },
  {
    id: "bullet",
    label: "Bullet list",
    icon: <IconBulletList />,
    keywords: ["unordered", "ul"],
    run: (e) => e.commands.toggleBulletList?.(),
  },
  {
    id: "ordered",
    label: "Numbered list",
    icon: <IconOrderedList />,
    keywords: ["ordered", "ol"],
    run: (e) => e.commands.toggleOrderedList?.(),
  },
  {
    id: "task",
    label: "Task list",
    icon: <IconTaskList />,
    keywords: ["todo", "checkbox", "checklist"],
    run: (e) => e.commands.toggleTaskList?.(),
  },
  {
    id: "quote",
    label: "Quote",
    icon: <IconBlockquote />,
    keywords: ["blockquote"],
    run: (e) => e.commands.toggleBlockquote?.(),
  },
  {
    id: "code",
    label: "Code block",
    icon: <IconCodeBlock />,
    keywords: ["pre", "snippet"],
    run: (e) => e.commands.setCodeBlock?.(),
  },
  {
    id: "hr",
    label: "Divider",
    icon: <IconHorizontalRule />,
    keywords: ["horizontal", "rule", "separator", "line"],
    run: (e) => e.commands.insertHorizontalRule?.(),
  },
  {
    id: "image",
    label: "Image",
    icon: <IconImage />,
    keywords: ["picture", "photo", "media"],
    run: (e) => {
      if (typeof window === "undefined") return;
      const src = window.prompt("Image URL", "https://");
      if (src) e.commands.insertImage?.({ src });
    },
  },
];

export interface SlashMenuProps {
  /** Override the command list. Defaults to DEFAULT_SLASH_ITEMS. */
  items?: SlashItem[];
}

export function SlashMenu({ items = DEFAULT_SLASH_ITEMS }: SlashMenuProps) {
  const editor = useEditorContext();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [active, setActive] = useState(0);

  // Detect "/" at the start of the current paragraph.
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
      if (!block || block.type !== "paragraph") {
        setOpen(false);
        return;
      }
      const text = getBlockText(block);
      // Active only while the block is exactly "/<query>" with no spaces
      // — a space ends the menu (you're writing a sentence, not a query).
      if (text.startsWith("/") && !/\s/.test(text)) {
        setQuery(text.slice(1));
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
    if (!q) return items;
    return items.filter(
      (it) =>
        it.label.toLowerCase().includes(q) ||
        it.keywords?.some((k) => k.toLowerCase().includes(q)),
    );
  }, [items, query]);

  // Keyboard navigation while the menu is open.
  useEffect(() => {
    // Only hijack Enter/Arrow/Escape when the menu is actually visible
    // (it renders only when there are matches). A "/query" that matches
    // nothing otherwise silently swallowed those keys from the editor.
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
        runItem(filtered[active]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    // Capture phase: run before the editor's own keydown handling so
    // Enter doesn't also split the paragraph.
    el.addEventListener("keydown", onKey, true);
    return () => el.removeEventListener("keydown", onKey, true);
    // `filtered` and `active` are dependencies so the handler always
    // sees the current list and highlight.
  }, [editor, open, filtered, active]);

  const runItem = (item?: SlashItem) => {
    if (!editor || !item) return;
    const sel = editor.getSelection();
    const idx = sel?.anchor.path[0] ?? 0;
    const doc = editor.getJSON();
    const block = doc.content[idx];
    if (block) block.content = [];
    // Clear the "/query" text first, then run the command on the now-empty block.
    editor.dispatch({
      doc,
      selection: {
        anchor: { path: [idx], offset: 0 },
        head: { path: [idx], offset: 0 },
      },
      addToHistory: true,
    });
    item.run(editor);
    setOpen(false);
  };

  if (!editor) return null;

  return (
    <Floating
      anchor={anchor}
      open={open && filtered.length > 0}
      placement="bottom"
      className="smeditor-slash-menu"
    >
      {filtered.map((it, i) => (
        <button
          key={it.id}
          type="button"
          role="menuitem"
          className={[
            "smeditor-slash-item",
            i === active ? "is-active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => setActive(i)}
          onClick={() => runItem(it)}
        >
          {it.icon !== undefined && (
            <span className="smeditor-slash-item__icon" aria-hidden="true">
              {it.icon}
            </span>
          )}
          <span className="smeditor-slash-item__label">{it.label}</span>
          {it.hint !== undefined && (
            <span className="smeditor-slash-item__hint">{it.hint}</span>
          )}
        </button>
      ))}
    </Floating>
  );
}
