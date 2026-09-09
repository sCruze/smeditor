/**
 * @smeditor/extension-find-replace
 *
 * Headless find & replace — the CKEditor/Tiptap "find in document"
 * feature, minus the UI. The library has no decoration system, so this
 * is a *search over the JSON document* that produces offset ranges plus
 * commands to navigate between matches and rewrite them.
 *
 * The document is `{ type: "doc", content: [blocks] }`. A *leaf* block
 * (paragraph, heading, a paragraph inside a table cell or list item)
 * holds inline content; matching happens against each leaf's *visible
 * text* (`blockVisibleText`). A match is reported as the block's path
 * plus a visible `[from, to)` range.
 *
 * Offset contract: a selection point's `offset` is a count of VISIBLE
 * characters into the addressed leaf block — the same indexing
 * `blockVisibleText` produces for plain text. Matches therefore use the
 * block path + visible offsets directly as a selection, and
 * `replaceInlineRange` (which also addresses content by visible offset)
 * rewrites exactly the matched span. This 1:1 mapping holds for plain
 * text; a block whose visible text comes from atomic inline nodes
 * (mentions) is matched on its label text, which is the established
 * behaviour for the rest of the engine.
 */

import type {
  Extension,
  EditorInstance,
  EditorSelection,
  DocumentJSON,
  DocumentNode,
} from "@smeditor/core";
import {
  cloneDoc,
  nodeAt,
  isLeafBlock,
  blockVisibleText,
  replaceInlineRange,
} from "@smeditor/core";

/** Options shared by every search-based operation. */
export interface FindOptions {
  /** Match case exactly. Default false (case-insensitive). */
  caseSensitive?: boolean;
  /**
   * Only match whole words — the occurrence must be bounded by a
   * non-word character (or the string edge) on each side. Default false.
   */
  wholeWord?: boolean;
}

/** A single occurrence: which leaf block, and its visible `[from, to)`. */
export interface FindMatch {
  /** Path from the doc root to the leaf block holding the match. */
  path: number[];
  /** Visible offset where the match starts (inclusive). */
  from: number;
  /** Visible offset where the match ends (exclusive). */
  to: number;
}

/**
 * Collect every leaf block in the document together with its path. A
 * block is a leaf when it has no block children (`isLeafBlock`); we walk
 * recursively rather than use the selection-based `leafBlocksInSelection`
 * so the whole document is searched regardless of where the caret is.
 */
function collectLeafBlocks(
  doc: DocumentJSON,
): Array<{ block: DocumentNode; path: number[] }> {
  const out: Array<{ block: DocumentNode; path: number[] }> = [];
  const walk = (node: DocumentNode, path: number[]) => {
    // The document root is never itself a "leaf" target — descend.
    if (node !== doc && isLeafBlock(node)) {
      out.push({ block: node, path });
      return;
    }
    const children = node.content ?? [];
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      // Skip inline leaves (text / hard_break / mention): they never
      // hold their own block path. Only descend into block children.
      if (child.type === "text") continue;
      walk(child, [...path, i]);
    }
  };
  walk(doc, []);
  return out;
}

/** True when `ch` is a "word" character for whole-word boundary checks. */
function isWordChar(ch: string | undefined): boolean {
  if (ch === undefined) return false;
  return /[\p{L}\p{N}_]/u.test(ch);
}

/**
 * Whether the occurrence at `[start, end)` in `text` is bounded by
 * word boundaries on both sides — i.e. the characters just outside the
 * match are non-word characters (or the string edge). This is a manual
 * `\b`-style check so the query may contain regex-special characters
 * without being interpreted as a pattern.
 */
function atWordBoundary(text: string, start: number, end: number): boolean {
  const before = start > 0 ? text[start - 1] : undefined;
  const after = end < text.length ? text[end] : undefined;
  return !isWordChar(before) && !isWordChar(after);
}

/**
 * Find every non-overlapping occurrence of `query` across all leaf
 * blocks. Uses plain `indexOf`-style scanning (NOT a RegExp) so the
 * query is treated literally even if it contains regex metacharacters.
 *
 * Returns the matches in document order. An empty query matches nothing.
 */
export function findMatches(
  doc: DocumentJSON,
  query: string,
  opts: FindOptions = {},
): FindMatch[] {
  if (!query) return [];

  const caseSensitive = opts.caseSensitive ?? false;
  const wholeWord = opts.wholeWord ?? false;
  const needle = caseSensitive ? query : query.toLowerCase();
  const matches: FindMatch[] = [];

  for (const { block, path } of collectLeafBlocks(doc)) {
    const visible = blockVisibleText(block);
    const haystack = caseSensitive ? visible : visible.toLowerCase();

    let searchFrom = 0;
    while (searchFrom <= haystack.length) {
      const idx = haystack.indexOf(needle, searchFrom);
      if (idx === -1) break;
      const end = idx + needle.length;
      if (!wholeWord || atWordBoundary(visible, idx, end)) {
        matches.push({ path, from: idx, to: end });
      }
      // Advance past this occurrence so matches don't overlap. (Empty
      // needle is impossible here — guarded above.)
      searchFrom = end;
    }
  }

  return matches;
}

/**
 * Compare two selection points in document order. Returns a negative
 * number if `a` comes before `b`, positive if after, 0 if equal. Paths
 * are compared index-by-index, then by offset.
 */
function comparePoint(
  aPath: number[],
  aOffset: number,
  bPath: number[],
  bOffset: number,
): number {
  const len = Math.max(aPath.length, bPath.length);
  for (let i = 0; i < len; i++) {
    const x = aPath[i] ?? -1;
    const y = bPath[i] ?? -1;
    if (x !== y) return x - y;
  }
  return aOffset - bOffset;
}

/** Turn a match into a selection (anchor at `from`, head at `to`). */
function selectionForMatch(match: FindMatch): EditorSelection {
  return {
    anchor: { path: match.path, offset: match.from },
    head: { path: match.path, offset: match.to },
  };
}

/**
 * Group matches by their block path so a block can have all its
 * replacements applied in one pass. Returns a map keyed by a stringified
 * path, each entry carrying the path and that block's matches.
 */
function groupByPath(
  matches: FindMatch[],
): Array<{ path: number[]; matches: FindMatch[] }> {
  const byKey = new Map<string, { path: number[]; matches: FindMatch[] }>();
  for (const m of matches) {
    const key = m.path.join(",");
    let entry = byKey.get(key);
    if (!entry) {
      entry = { path: m.path, matches: [] };
      byKey.set(key, entry);
    }
    entry.matches.push(m);
  }
  return [...byKey.values()];
}

/** Options accepted by the navigation/replacement commands. */
interface QueryOptions extends FindOptions {
  query: string;
}
interface ReplaceOptions extends QueryOptions {
  replacement: string;
}

/**
 * The find & replace extension. Adds no nodes or marks — only commands
 * that search the document and move/replace, dispatching transactions.
 */
export const FindReplaceExtension: Extension = {
  name: "find_replace",
  commands: {
    /**
     * replaceAll({ query, replacement, caseSensitive?, wholeWord? }) —
     * replace every occurrence of `query` with `replacement`. Clones the
     * doc, mutates each affected block (right-to-left so earlier offsets
     * stay valid), and dispatches ONE transaction. Returns true if at
     * least one match was replaced.
     */
    replaceAll:
      (opts: ReplaceOptions) =>
      (editor: EditorInstance): boolean => {
        const source = editor.getJSON();
        const matches = findMatches(source, opts.query, opts);
        if (matches.length === 0) return false;

        const replacementNodes: DocumentNode[] = opts.replacement
          ? [{ type: "text", text: opts.replacement }]
          : [];

        const doc = cloneDoc(source);
        for (const { path, matches: blockMatches } of groupByPath(matches)) {
          const block = nodeAt(doc, path);
          if (!block) continue;
          // Right-to-left: replacing a later range can't shift the
          // offsets of an earlier one.
          const ordered = [...blockMatches].sort((a, b) => b.from - a.from);
          for (const m of ordered) {
            block.content = replaceInlineRange(
              block.content ?? [],
              m.from,
              m.to,
              replacementNodes,
            );
          }
        }

        editor.dispatch({ doc, selection: null, addToHistory: true });
        return true;
      },

    /**
     * findNext({ query, caseSensitive?, wholeWord? }) — select the first
     * match at or after the current selection, wrapping to the first
     * match when none follow. Returns true if any match exists.
     */
    findNext:
      (opts: QueryOptions) =>
      (editor: EditorInstance): boolean => {
        const matches = findMatches(editor.getJSON(), opts.query, opts);
        if (matches.length === 0) return false;

        const sel = editor.getSelection();
        let target = matches[0];
        if (sel) {
          // Anchor the search to the END of the current selection so a
          // match the caret is already sitting on is skipped.
          const fromPath = sel.head.path;
          const fromOffset = sel.head.offset;
          const next = matches.find(
            (m) =>
              comparePoint(m.path, m.from, fromPath, fromOffset) >= 0,
          );
          if (next) target = next;
          // else: wrap — `target` stays the first match.
        }

        editor.dispatch({ selection: selectionForMatch(target) });
        return true;
      },

    /**
     * findPrevious({ query, caseSensitive?, wholeWord? }) — select the
     * last match before the current selection, wrapping to the last match
     * when none precede. Returns true if any match exists.
     */
    findPrevious:
      (opts: QueryOptions) =>
      (editor: EditorInstance): boolean => {
        const matches = findMatches(editor.getJSON(), opts.query, opts);
        if (matches.length === 0) return false;

        const sel = editor.getSelection();
        let target = matches[matches.length - 1];
        if (sel) {
          // Anchor to the START of the current selection so we don't pick
          // the match the caret is sitting on as the "previous" one.
          const fromPath = sel.anchor.path;
          const fromOffset = sel.anchor.offset;
          let prev: FindMatch | undefined;
          for (const m of matches) {
            // Matches are in document order; take the last one that
            // starts strictly before the current selection.
            if (comparePoint(m.path, m.from, fromPath, fromOffset) < 0) {
              prev = m;
            } else {
              break;
            }
          }
          if (prev) target = prev;
          // else: wrap — `target` stays the last match.
        }

        editor.dispatch({ selection: selectionForMatch(target) });
        return true;
      },

    /**
     * replaceNext({ query, replacement, caseSensitive?, wholeWord? }) —
     * if the CURRENT selection exactly equals one of the match ranges,
     * replace just that one and then advance to the next match. Otherwise
     * simply move to the next match without replacing. This mirrors the
     * usual "Replace" button: click once to select, click again to
     * replace-and-advance.
     */
    replaceNext:
      (opts: ReplaceOptions) =>
      (editor: EditorInstance): boolean => {
        const matches = findMatches(editor.getJSON(), opts.query, opts);
        if (matches.length === 0) return false;

        const sel = editor.getSelection();
        const current =
          sel &&
          matches.find(
            (m) =>
              comparePoint(m.path, m.from, sel.anchor.path, sel.anchor.offset) ===
                0 &&
              comparePoint(m.path, m.to, sel.head.path, sel.head.offset) === 0,
          );

        if (current) {
          const replacementNodes: DocumentNode[] = opts.replacement
            ? [{ type: "text", text: opts.replacement }]
            : [];
          const doc = cloneDoc(editor.getJSON());
          const block = nodeAt(doc, current.path);
          if (block) {
            block.content = replaceInlineRange(
              block.content ?? [],
              current.from,
              current.to,
              replacementNodes,
            );
            // Collapse the caret to the end of the inserted replacement
            // so the following findNext looks past it.
            const caret = current.from + opts.replacement.length;
            editor.dispatch({
              doc,
              selection: {
                anchor: { path: current.path, offset: caret },
                head: { path: current.path, offset: caret },
              },
              addToHistory: true,
            });
          }
        }

        return editor.commands.findNext?.(opts) ?? false;
      },
  },
};

export default FindReplaceExtension;
