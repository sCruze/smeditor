/**
 * @smeditor/extension-typography
 *
 * Smart typography. Input rules that watch the text typed up to the
 * caret and substitute common ASCII sequences with their proper
 * typographic characters — the same idea as Tiptap's Typography
 * extension or CKEditor's autoformat:
 *
 *   (c) (r) (tm)     → © ® ™
 *   ...              → … (ellipsis)
 *   -- ---           → – — (en / em dash)
 *   -> <- <-> =>     → → ← ↔ ⇒
 *   +- != <= >=      → ± ≠ ≤ ≥
 *   1/2 1/4 3/4      → ½ ¼ ¾ (only when not part of a longer number)
 *   " '              → “ ” ‘ ’ (smart quotes, opening vs. closing)
 *
 * Headless: this extension contributes only `inputRules`, so it works
 * in any kit regardless of which nodes / marks are loaded.
 *
 * Implementation note: a rule fires from the editor's input-rule
 * engine, which matches `match` against the block text up to the caret
 * and hands the handler the editor plus the regex match. Each rule
 * here replaces the matched trigger (`m[0]`) with a single
 * typographic character, using the offset-aware `replaceInlineRange`
 * helper so a substitution mid-paragraph keeps the surrounding text
 * intact.
 */

import type { Extension, InputRule, DocumentNode } from "@smeditor/core";
import { cloneDoc, nodeAt, replaceInlineRange } from "@smeditor/core";

/**
 * Generic substitution rule: when `match` fires, replace the matched
 * trigger (`m[0]`) with `replacement` (a single typographic character).
 *
 * Lookbehind assertions in `match` are zero-width, so they never form
 * part of `m[0]` — `start` is simply `caret - m[0].length`, which keeps
 * any prefix the lookbehind asserted (a space, a non-digit, …) in
 * place. The replacement becomes a plain text node carrying no marks.
 */
function replaceRule(match: RegExp, replacement: string): InputRule {
  return {
    match,
    handler: (editor, m) => {
      const sel = editor.getSelection();
      if (!sel) return false;
      const path = sel.anchor.path;
      const caret = sel.anchor.offset;
      const start = caret - m[0].length;
      if (start < 0) return false;
      const doc = cloneDoc(editor.getJSON());
      const block = nodeAt(doc, path);
      if (!block) return false;
      const textNode: DocumentNode = { type: "text", text: replacement };
      block.content = replaceInlineRange(
        block.content ?? [],
        start,
        caret,
        [textNode],
      );
      const offset = start + replacement.length;
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
  // Trademark / copyright symbols.
  replaceRule(/\(c\)$/, "©"), // ©
  replaceRule(/\(r\)$/, "®"), // ®
  replaceRule(/\(tm\)$/, "™"), // ™

  // Ellipsis.
  replaceRule(/\.\.\.$/, "…"), // …

  // Dashes — the em dash (`---`) is tested BEFORE the en dash (`--`)
  // so the longer sequence wins.
  replaceRule(/---$/, "—"), // — em dash
  replaceRule(/--$/, "–"), // – en dash

  // Arrows — the two-headed `<->` is tested before `<-`/`->`.
  replaceRule(/<->$/, "↔"), // ↔
  replaceRule(/->$/, "→"), // →
  replaceRule(/<-$/, "←"), // ←
  replaceRule(/=>$/, "⇒"), // ⇒

  // Math / comparison operators.
  replaceRule(/\+-$/, "±"), // ±
  replaceRule(/!=$/, "≠"), // ≠
  replaceRule(/<=$/, "≤"), // ≤
  replaceRule(/>=$/, "≥"), // ≥

  // Fractions — only when not preceded by a digit or a slash, so that
  // dates / longer fractions like `21/2` don't get rewritten. The
  // lookbehind is zero-width, so `m[0]` is just the fraction itself.
  replaceRule(/(?<![\d/])1\/2$/, "½"), // ½
  replaceRule(/(?<![\d/])1\/4$/, "¼"), // ¼
  replaceRule(/(?<![\d/])3\/4$/, "¾"), // ¾

  // Smart quotes — the opening form (start of block, or after
  // whitespace / an opening bracket) is tested before the closing
  // form, which is the catch-all. Lookbehind is zero-width so `m[0]`
  // is only the quote character.
  replaceRule(/(?<=^|[\s([{])"$/, "“"), // “ opening double
  replaceRule(/"$/, "”"), // ” closing double
  replaceRule(/(?<=^|[\s([{])'$/, "‘"), // ‘ opening single
  replaceRule(/'$/, "’"), // ’ closing single / apostrophe
];

export const TypographyExtension: Extension = {
  name: "typography",
  inputRules: rules,
};

export default TypographyExtension;
