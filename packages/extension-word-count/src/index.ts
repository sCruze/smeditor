/**
 * @smeditor/extension-word-count
 *
 * Doesn't add any nodes, marks, or commands — only utilities that
 * walk the current document and return character/word counts.
 *
 * Apps subscribe to `editor.on('update', …)` and call `countWords` /
 * `countCharacters` on each update, then render the totals somewhere
 * in their own UI. This keeps the extension surface tiny and lets
 * apps choose where the counts live (footer, sidebar, status bar, …).
 */

import type {
  Extension,
  EditorInstance,
  DocumentJSON,
  DocumentNode,
} from "@smeditor/core";

function walkText(node: DocumentNode | DocumentJSON, sink: (text: string) => void): void {
  if (node.type === "text") {
    sink(node.text ?? "");
    return;
  }
  if (!node.content) return;
  // Insert a space after every non-text child so sibling block boundaries
  // (list items, table cells, blockquote paragraphs, …) become whitespace
  // and don't merge into one word. Adjacent text leaves stay un-separated so
  // a word split across mark boundaries ("wor" + "ld") remains one word.
  for (const child of node.content) {
    walkText(child, sink);
    if (child.type !== "text") sink(" ");
  }
}

export function getPlainText(doc: DocumentJSON): string {
  // Build each top-level block's text, then join with a single space so word
  // counts don't run together — without a spurious trailing space.
  const top = doc.content ?? [];
  return top
    .map((block) => {
      const parts: string[] = [];
      walkText(block, (t) => parts.push(t));
      return parts.join("");
    })
    .join(" ");
}

/** Count of Unicode characters (ignoring surrogate-pair quirks). */
export function countCharacters(doc: DocumentJSON, opts?: { includeSpaces?: boolean }): number {
  const text = getPlainText(doc);
  if (opts?.includeSpaces === false) return text.replace(/\s+/g, "").length;
  return text.length;
}

/**
 * Count of words. A word is a maximal run of non-whitespace characters.
 * Matches what most UIs show — Google Docs, Word, Notion all use this
 * definition for their word counts.
 */
export function countWords(doc: DocumentJSON): number {
  const text = getPlainText(doc).trim();
  if (!text) return 0;
  return text.split(/\s+/).length;
}

/** Options for the word-count extension. */
export interface WordCountOptions {
  /**
   * Maximum allowed count. When undefined, enforcement is OFF and the
   * extension only counts (the historical behavior). When set, typing
   * past the limit is blocked via `handleTextInput`.
   */
  limit?: number;
  /** Whether `limit` counts characters or words. Defaults to "characters". */
  mode?: "characters" | "words";
}

/**
 * Build a (possibly configured) word-count extension.
 *
 * With no `limit`, the returned extension is identical to the original:
 * just a name, no `handleTextInput`, so it never blocks input and does
 * not affect StarterKit/FullKit or existing behavior. With a `limit`,
 * it adds a `handleTextInput` hook that refuses input once the limit
 * would be exceeded.
 */
function makeExtension(options: WordCountOptions): Extension {
  const ext: Extension = {
    name: "word_count",
    // No nodes, marks, commands, or shortcuts. The package exists so it
    // shows up in the StarterKit/FullKit bundles and the helpers above
    // are importable from a stable module path.
    configure(o: Record<string, unknown>): Extension {
      return makeExtension({ ...options, ...(o as WordCountOptions) });
    },
  };

  // Enforcement is strictly opt-in: only attach the hook when a limit is
  // given, so the unconfigured extension behaves EXACTLY as before.
  if (typeof options.limit === "number") {
    const limit = options.limit;
    const mode = options.mode ?? "characters";

    ext.handleTextInput = (editor: EditorInstance, text: string): boolean => {
      const doc = editor.getJSON();

      if (mode === "words") {
        // Words mode (simple, conservative): only block input that would
        // start a NEW word once we're already at/over the word limit.
        // Typing inside or extending an existing word is always allowed,
        // and whitespace never starts a word, so it's allowed too.
        const startsNewWord = /\S/.test(text);
        if (!startsNewWord) return false;
        return countWords(doc) >= limit;
      }

      // Characters mode (the primary use case): block when the incoming
      // text would push the total past the limit. includeSpaces defaults
      // to true, matching countCharacters' default.
      const current = countCharacters(doc);
      return current + text.length > limit;
    };
  }

  return ext;
}

export const WordCountExtension: Extension = makeExtension({});

export default WordCountExtension;
