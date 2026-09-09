/**
 * SearchPanel — a find & replace UI driving the commands registered by
 * `@smeditor/extension-find-replace`.
 *
 * The panel never imports the extension directly: it calls commands by
 * name (`findNext`, `findPrevious`, `replaceNext`, `replaceAll`) with
 * the optional-chain pattern used everywhere else in this package. If
 * the extension isn't loaded the commands are absent and the panel
 * renders nothing.
 *
 * The live match count is derived locally — walking the document's
 * blocks with `blockVisibleText` — so the panel doesn't need to reach
 * into the extension's search algorithm. It's a plain-text count, good
 * enough for the "N matches" hint next to the controls.
 *
 * Keyboard: Enter in the query field jumps to the next match, Escape
 * clears both fields. Buttons cover prev / next / replace / replace-all.
 */

import { useEffect, useMemo, useState } from "react";
import type { EditorInstance, DocumentNode } from "@smeditor/core";
import { blockVisibleText } from "@smeditor/core";

export interface SearchPanelProps {
  /** The editor to search. Renders nothing while null. */
  editor: EditorInstance | null;
  className?: string;
}

interface SearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
}

/** True when the find-replace extension has registered its commands. */
function hasFindReplace(editor: EditorInstance | null): boolean {
  return typeof editor?.commands.findNext === "function";
}

/** Escape a string for safe use inside a RegExp. */
function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Count plain-text occurrences of `query` across every block's visible
 * text. Mirrors the search semantics the extension exposes (case and
 * whole-word options) without depending on it.
 */
function countMatches(
  editor: EditorInstance | null,
  query: string,
  opts: SearchOptions,
): number {
  if (!editor || !query) return 0;
  let pattern = escapeRegExp(query);
  if (opts.wholeWord) pattern = `\\b${pattern}\\b`;
  let regex: RegExp;
  try {
    regex = new RegExp(pattern, opts.caseSensitive ? "g" : "gi");
  } catch {
    return 0;
  }

  let total = 0;
  // Walk leaf blocks only: `blockVisibleText` already descends into all
  // nested inline/block content, so recursing into container blocks too
  // would double-count text living inside lists, quotes, tables, etc.
  const walk = (blocks: DocumentNode[] | undefined) => {
    if (!blocks) return;
    for (const block of blocks) {
      const childBlocks = (block.content ?? []).filter(
        (child) => child.type !== "text" && child.content !== undefined,
      );
      if (childBlocks.length > 0) {
        // Container block — descend so we count each leaf exactly once.
        walk(childBlocks);
        continue;
      }
      const text = blockVisibleText(block);
      if (text) {
        const matches = text.match(regex);
        if (matches) total += matches.length;
      }
    }
  };
  walk(editor.getJSON().content);
  return total;
}

export function SearchPanel({ editor, className }: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  // Bumped on document updates so the match count re-derives.
  const [version, setVersion] = useState(0);

  // Re-derive the count whenever the document changes.
  useEffect(() => {
    if (!editor) return;
    const bump = () => setVersion((v) => v + 1);
    const off = editor.on("update", bump);
    return () => off?.();
  }, [editor]);

  const options = useMemo<SearchOptions>(
    () => ({ caseSensitive, wholeWord }),
    [caseSensitive, wholeWord],
  );

  const matchCount = useMemo(
    () => countMatches(editor, query, options),
    // `version` forces a recount on edits even though it isn't read here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor, query, options, version],
  );

  // Extension absent → nothing to drive.
  if (!hasFindReplace(editor) || !editor) return null;

  const findNext = () => {
    if (!query) return;
    editor.commands.findNext?.({ query, caseSensitive, wholeWord });
  };
  const findPrevious = () => {
    if (!query) return;
    editor.commands.findPrevious?.({ query, caseSensitive, wholeWord });
  };
  const replaceNext = () => {
    if (!query) return;
    editor.commands.replaceNext?.({
      query,
      replacement,
      caseSensitive,
      wholeWord,
    });
  };
  const replaceAll = () => {
    if (!query) return;
    editor.commands.replaceAll?.({
      query,
      replacement,
      caseSensitive,
      wholeWord,
    });
  };

  const onQueryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) findPrevious();
      else findNext();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setQuery("");
      setReplacement("");
    }
  };

  return (
    <div
      className={["smeditor-search-panel", className]
        .filter(Boolean)
        .join(" ")}
      role="search"
      aria-label="Find and replace"
    >
      <div className="smeditor-search-panel__row">
        <input
          type="text"
          className="smeditor-search-panel__input"
          aria-label="Find"
          placeholder="Find"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onQueryKeyDown}
        />
        <span
          className="smeditor-search-panel__count"
          aria-live="polite"
          aria-label={`${matchCount} matches`}
        >
          {matchCount}
        </span>
        <button
          type="button"
          className="smeditor-button smeditor-search-panel__nav"
          aria-label="Previous match"
          title="Previous match"
          onMouseDown={(e) => e.preventDefault()}
          onClick={findPrevious}
        >
          ◀
        </button>
        <button
          type="button"
          className="smeditor-button smeditor-search-panel__nav"
          aria-label="Next match"
          title="Next match"
          onMouseDown={(e) => e.preventDefault()}
          onClick={findNext}
        >
          ▶
        </button>
      </div>

      <div className="smeditor-search-panel__row">
        <input
          type="text"
          className="smeditor-search-panel__input"
          aria-label="Replace with"
          placeholder="Replace"
          value={replacement}
          onChange={(e) => setReplacement(e.target.value)}
        />
        <button
          type="button"
          className="smeditor-button smeditor-search-panel__action"
          aria-label="Replace next match"
          title="Replace"
          onMouseDown={(e) => e.preventDefault()}
          onClick={replaceNext}
        >
          Replace
        </button>
        <button
          type="button"
          className="smeditor-button smeditor-search-panel__action"
          aria-label="Replace all matches"
          title="Replace all"
          onMouseDown={(e) => e.preventDefault()}
          onClick={replaceAll}
        >
          Replace All
        </button>
      </div>

      <div className="smeditor-search-panel__row smeditor-search-panel__options">
        <label className="smeditor-search-panel__option">
          <input
            type="checkbox"
            checked={caseSensitive}
            onChange={(e) => setCaseSensitive(e.target.checked)}
          />
          <span>Case sensitive</span>
        </label>
        <label className="smeditor-search-panel__option">
          <input
            type="checkbox"
            checked={wholeWord}
            onChange={(e) => setWholeWord(e.target.checked)}
          />
          <span>Whole word</span>
        </label>
      </div>
    </div>
  );
}
