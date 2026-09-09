/**
 * Zero-dependency, language-agnostic syntax highlighter.
 *
 * The editor rebuilds its contenteditable surface from JSON on every
 * change, so injecting highlight markup into the live surface would just
 * be parsed back out — there is no decoration layer. Instead this is a
 * pure `code -> highlighted HTML` helper for rendering a code block
 * read-only (a preview pane, exported document, or a custom node view).
 *
 * It is intentionally generic rather than per-grammar: it tokenises
 * comments, strings, numbers and a common keyword set. Good enough for a
 * readable preview without pulling in a multi-hundred-KB grammar library.
 * Output is safe — the source is HTML-escaped before any markup is added.
 */

const KEYWORDS = new Set([
  // JS/TS-ish, but a useful superset for most C-family languages
  "abstract", "as", "async", "await", "break", "case", "catch", "class",
  "const", "continue", "debugger", "declare", "default", "delete", "do",
  "else", "enum", "export", "extends", "false", "finally", "for", "from",
  "function", "if", "implements", "import", "in", "instanceof", "interface",
  "let", "new", "null", "of", "private", "protected", "public", "readonly",
  "return", "static", "super", "switch", "this", "throw", "true", "try",
  "type", "typeof", "undefined", "var", "void", "while", "yield",
  "def", "elif", "lambda", "pass", "raise", "with", "and", "or", "not",
  "func", "package", "struct", "fn", "match", "use", "pub", "mut", "impl",
  "select", "where", "join", "and", "begin", "end", "nil", "then",
]);

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const TOKEN = new RegExp(
  [
    "(\\/\\/[^\\n]*|#[^\\n]*|--[^\\n]*)", // line comments
    "(\\/\\*[\\s\\S]*?\\*\\/)", // block comments
    "(\"(?:\\\\.|[^\"\\\\])*\"|'(?:\\\\.|[^'\\\\])*'|`(?:\\\\.|[^`\\\\])*`)", // strings
    "(\\b\\d[\\d_.eExXa-fA-F]*\\b)", // numbers
    "([A-Za-z_$][A-Za-z0-9_$]*)", // identifiers / keywords
  ].join("|"),
  "g",
);

/**
 * Highlight `code` and return an HTML string of `<span class="gv-tok-*">`
 * tokens. `language` is accepted for API parity / future per-grammar
 * tuning but the current tokeniser is language-agnostic.
 */
export function highlightCode(code: string, _language?: string): string {
  let out = "";
  let last = 0;
  for (const m of code.matchAll(TOKEN)) {
    const idx = m.index ?? 0;
    if (idx > last) out += escapeHtml(code.slice(last, idx));
    const [whole, lineComment, blockComment, str, num, ident] = m;
    if (lineComment || blockComment) {
      out += `<span class="gv-tok-comment">${escapeHtml(whole)}</span>`;
    } else if (str) {
      out += `<span class="gv-tok-string">${escapeHtml(whole)}</span>`;
    } else if (num) {
      out += `<span class="gv-tok-number">${escapeHtml(whole)}</span>`;
    } else if (ident) {
      out += KEYWORDS.has(ident)
        ? `<span class="gv-tok-keyword">${escapeHtml(whole)}</span>`
        : escapeHtml(whole);
    } else {
      out += escapeHtml(whole);
    }
    last = idx + whole.length;
  }
  if (last < code.length) out += escapeHtml(code.slice(last));
  return out;
}
