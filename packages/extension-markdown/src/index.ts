/**
 * @smeditor/extension-markdown
 *
 * Markdown input shortcuts. Each rule watches the text typed at the
 * start of a block and, when it matches, rewrites the block:
 *
 *   `# ` … `###### `  → Heading 1-6
 *   `> `              → Blockquote
 *   `- ` / `* ` / `+ `→ Bullet list
 *   `1. `             → Ordered list
 *   ` ``` `           → Code block
 *   `--- `            → Horizontal rule
 *
 * These cover §11 "Markdown shortcuts" of the brief. The rules call
 * the same commands the toolbar buttons use, so behaviour stays
 * consistent however the user triggers it.
 *
 * Implementation note: a rule fires from `editor`'s input-rule engine,
 * which hands the handler the editor plus the regex match. The handler
 * strips the typed prefix, then either changes the block type
 * directly or delegates to a command.
 */

import type {
  Extension,
  EditorInstance,
  InputRule,
  DocumentNode,
} from "@smeditor/core";
import {
  cloneDoc,
  stripBlockPrefix,
  nodeAt,
  replaceInlineRange,
} from "@smeditor/core";

/** Place the caret at the start of the block identified by `path`. */
function caretAtBlockStart(path: number[]) {
  return {
    anchor: { path, offset: 0 },
    head: { path, offset: 0 },
  };
}

/**
 * Strip the matched prefix from the current block and turn the block
 * into `type` with `attrs`. Used by the heading rule.
 *
 * The target is resolved by the FULL selection path (via `nodeAt`), so a
 * rule that fires from text inside a table cell / nested list paragraph
 * retypes that leaf block rather than the top-level container.
 */
function retypeBlock(
  editor: EditorInstance,
  prefixLength: number,
  type: string,
  attrs?: Record<string, unknown>,
): boolean {
  const sel = editor.getSelection();
  if (!sel) return false;
  const path = sel.anchor.path;
  const doc = cloneDoc(editor.getJSON());
  const block = nodeAt(doc, path);
  if (!block) return false;
  stripBlockPrefix(block, prefixLength);
  block.type = type;
  if (attrs) block.attrs = { ...(block.attrs ?? {}), ...attrs };
  else if (block.attrs) delete block.attrs;
  editor.dispatch({
    doc,
    selection: caretAtBlockStart(path),
    addToHistory: true,
  });
  return true;
}

/**
 * Strip the matched prefix, then run a command (used for list / quote
 * rules where the command does the wrapping).
 *
 * The target leaf is resolved by the FULL selection path. The
 * prefix-strip is dispatched with `addToHistory:false` so that the strip
 * plus the delegated command collapse into a single undo step (the
 * delegated command records the one history entry).
 */
function stripThenCommand(
  editor: EditorInstance,
  prefixLength: number,
  run: (editor: EditorInstance) => boolean,
): boolean {
  const sel = editor.getSelection();
  if (!sel) return false;
  const path = sel.anchor.path;
  const doc = cloneDoc(editor.getJSON());
  const block = nodeAt(doc, path);
  if (!block) return false;
  stripBlockPrefix(block, prefixLength);
  editor.dispatch({
    doc,
    selection: caretAtBlockStart(path),
    addToHistory: false,
  });
  return run(editor);
}

/**
 * Inline markdown shortcut: when the user finishes typing a wrapped
 * span (e.g. `**bold**`), replace the visible range with a single text
 * node carrying `markType`, dropping the delimiters. The mark is only
 * applied when the schema actually has it, so the rule is a no-op (the
 * text stays literal) in a kit that doesn't load that mark.
 */
function inlineMarkRule(match: RegExp, markType: string): InputRule {
  return {
    match,
    handler: (editor, m) => {
      if (!editor.schema.marks[markType]) return false;
      const sel = editor.getSelection();
      if (!sel) return false;
      const inner = m[1];
      if (!inner) return false;
      const path = sel.anchor.path;
      const caret = sel.anchor.offset;
      const start = caret - m[0].length;
      if (start < 0) return false;
      const doc = cloneDoc(editor.getJSON());
      const block = nodeAt(doc, path);
      if (!block) return false;
      const marked: DocumentNode = {
        type: "text",
        text: inner,
        marks: [{ type: markType }],
      };
      block.content = replaceInlineRange(
        block.content ?? [],
        start,
        caret,
        [marked],
      );
      const offset = start + inner.length;
      editor.dispatch({
        doc,
        selection: { anchor: { path, offset }, head: { path, offset } },
        addToHistory: true,
      });
      return true;
    },
  };
}

const rules: InputRule[] = [
  // Headings — # … ######  (note the trailing space in the typed text)
  {
    match: /^(#{1,6})\s$/,
    handler: (editor, m) =>
      retypeBlock(editor, m[0].length, "heading", { level: m[1].length }),
  },
  // Blockquote — "> "
  {
    match: /^>\s$/,
    handler: (editor, m) =>
      stripThenCommand(
        editor,
        m[0].length,
        (e) => e.commands.toggleBlockquote?.() ?? false,
      ),
  },
  // Bullet list — "- ", "* ", "+ "
  {
    match: /^[-*+]\s$/,
    handler: (editor, m) =>
      stripThenCommand(
        editor,
        m[0].length,
        (e) => e.commands.toggleBulletList?.() ?? false,
      ),
  },
  // Ordered list — "1. " (any starting number)
  {
    match: /^\d+\.\s$/,
    handler: (editor, m) =>
      stripThenCommand(
        editor,
        m[0].length,
        (e) => e.commands.toggleOrderedList?.() ?? false,
      ),
  },
  // Code block — "```"
  {
    match: /^```$/,
    handler: (editor, m) =>
      stripThenCommand(
        editor,
        m[0].length,
        (e) => e.commands.setCodeBlock?.() ?? false,
      ),
  },
  // Horizontal rule — "--- "
  {
    match: /^---\s$/,
    handler: (editor, m) =>
      stripThenCommand(
        editor,
        m[0].length,
        (e) => e.commands.insertHorizontalRule?.() ?? false,
      ),
  },
  // Inline marks — completing a wrapped span autoformats it. Order
  // matters: the double-delimiter forms are tested before the single
  // ones so `**bold**` isn't mistaken for `*italic*`.
  inlineMarkRule(/\*\*([^*\n]+)\*\*$/, "bold"),
  inlineMarkRule(/(?<!\*)\*([^*\n]+)\*$/, "italic"),
  inlineMarkRule(/~~([^~\n]+)~~$/, "strike"),
  inlineMarkRule(/`([^`\n]+)`$/, "code"),
];

export const MarkdownExtension: Extension = {
  name: "markdown",
  inputRules: rules,
};

export default MarkdownExtension;

// Markdown <-> document conversion (§16). Pure functions — usable
// without an editor instance.
export { toMarkdown } from "./to-markdown.js";
export { fromMarkdown } from "./from-markdown.js";
