/**
 * @smeditor/extension-link
 *
 * Hyperlink mark. Stores `href` (required) and optional `title` and
 * `target` attributes. Parses both `<a href="…">` and `<a href="…"
 * target="_blank">`.
 *
 * Security: href values are sanitized when commands run, when HTML is parsed
 * and again when JSON is serialized back to HTML. Apps that need a broader
 * allowlist can configure it via `LinkExtension.configure({ protocols: [...] })`.
 */

import type {
  Extension,
  EditorInstance,
  InputRule,
  Mark,
  DocumentNode,
} from "@smeditor/core";
import {
  cloneDoc,
  hardenLinkAttrs,
  nodeAt,
  sanitizeLinkTarget,
  sanitizeURL,
  setMarkAcrossSelection,
  setMarkOnInlineRange,
  unsetMarkAcrossSelection,
} from "@smeditor/core";

export interface LinkOptions {
  /** Allowed URL protocols. Defaults to http, https, mailto, tel. */
  protocols?: string[];
  /** Whether to add `rel="noopener noreferrer"` to external links. */
  hardenExternal?: boolean;
}

const DEFAULTS: Required<LinkOptions> = {
  protocols: ["http", "https", "mailto", "tel"],
  hardenExternal: true,
};

/**
 * Does any text node overlapping the visible range `[from, to)` already
 * carry a `link` mark? Used by the autolink rule to avoid re-linking a
 * URL that's already inside a link.
 */
function rangeHasLink(
  content: DocumentNode[],
  from: number,
  to: number,
): boolean {
  let offset = 0;
  for (const node of content) {
    if (node.type !== "text" || typeof node.text !== "string") continue;
    const start = offset;
    const end = offset + node.text.length;
    offset = end;
    // Overlap with [from, to)?
    if (end <= from || start >= to) continue;
    if (node.marks?.some((mark) => mark.type === "link")) return true;
  }
  return false;
}

function makeExtension(options: LinkOptions): Extension {
  const opts = { ...DEFAULTS, ...options };

  const sanitizeHref = (href: unknown): string | null =>
    sanitizeURL(href, {
      protocols: opts.protocols,
      allowBareEmail: true,
    });

  const linkAttrs = (
    params: { href?: unknown; title?: unknown; target?: unknown },
  ): Record<string, unknown> | null => {
    const href = sanitizeHref(params.href);
    if (!href) return null;

    const attrs: Record<string, unknown> = { href };
    if (typeof params.title === "string" && params.title) attrs.title = params.title;
    const target = sanitizeLinkTarget(params.target);
    if (target) attrs.target = target;
    return attrs;
  };

  // Autolink: typing a bare URL followed by a space wraps the URL in a
  // link mark. The leading `(?:^|\s)` lets the URL sit either at the
  // start of the block or after whitespace; group 1 is the URL and
  // group 2 is the single trailing space that triggered the rule. Both
  // Tiptap and CKEditor offer this convenience.
  const autolinkRule: InputRule = {
    match: /(?:^|\s)(https?:\/\/[^\s]+|www\.[^\s]+)(\s)$/,
    handler: (editor: EditorInstance, m: RegExpExecArray): boolean => {
      const sel = editor.getSelection();
      if (!sel) return false;

      const url = m[1];
      if (!url) return false;

      // The trailing space (m[2]) sits at caret - 1; the URL ends just
      // before it and starts m[1].length characters earlier.
      const caret = sel.anchor.offset;
      const urlEnd = caret - 1;
      const urlStart = urlEnd - url.length;
      if (urlStart < 0) return false;

      // `www.` URLs need an explicit scheme before they can be
      // sanitized; refuse anything sanitizeHref rejects (e.g. unsafe
      // protocols), leaving the typed text untouched.
      const candidate = url.startsWith("www.") ? `https://${url}` : url;
      const attrs = linkAttrs({ href: candidate });
      if (!attrs) return false;

      const path = sel.anchor.path;
      const doc = cloneDoc(editor.getJSON());
      const block = nodeAt(doc, path);
      if (!block) return false;

      // Don't re-link text that already carries a link mark.
      if (rangeHasLink(block.content ?? [], urlStart, urlEnd)) return false;

      block.content = setMarkOnInlineRange(
        block.content ?? [],
        urlStart,
        urlEnd,
        { type: "link", attrs },
      );

      // Keep the caret where it is (just after the trailing space). The
      // link mark is `inclusive: false`, so the space stays unlinked.
      editor.dispatch({
        doc,
        selection: {
          anchor: { path, offset: caret },
          head: { path, offset: caret },
        },
        addToHistory: true,
      });
      return true;
    },
  };

  return {
    name: "link",
    inputRules: [autolinkRule],
    marks: [
      {
        name: "link",
        // Links should NOT be inclusive — when the caret sits just past
        // a link and the user types, the new text should be unlinked.
        inclusive: false,
        attrs: {
          href: {},
          title: { default: null },
          target: { default: null },
        },
        toDOM: (mark: Mark) => {
          const attrs = linkAttrs(mark.attrs ?? {});
          if (!attrs) return ["span", 0];

          const htmlAttrs: Record<string, string> = { href: String(attrs.href) };
          if (typeof attrs.title === "string") htmlAttrs.title = attrs.title;
          if (typeof attrs.target === "string") htmlAttrs.target = attrs.target;
          return [
            "a",
            opts.hardenExternal ? hardenLinkAttrs(htmlAttrs) : htmlAttrs,
            0,
          ];
        },
        parseDOM: [
          {
            tag: "a",
            getAttrs: (el) => {
              const attrs = linkAttrs({
                href: el.getAttribute("href") ?? "",
                title: el.getAttribute("title") ?? undefined,
                target: el.getAttribute("target") ?? undefined,
              });
              return attrs ?? false;
            },
          },
        ],
      },
    ],
    commands: {
      /** setLink({ href, title?, target? }) — applies to the selected range. */
      setLink:
        (params: { href: string; title?: string; target?: string }) =>
        (editor: EditorInstance): boolean => {
          const attrs = linkAttrs(params ?? {});
          if (!attrs) return false;
          const selection = editor.getSelection();
          const next = setMarkAcrossSelection(editor.getJSON(), selection, {
            type: "link",
            attrs,
          });
          if (!next) return false;
          editor.dispatch({ doc: next, selection, addToHistory: true });
          return true;
        },
      /** unsetLink() — remove the link mark from the selected range. */
      unsetLink:
        () =>
        (editor: EditorInstance): boolean => {
          const selection = editor.getSelection();
          const next = unsetMarkAcrossSelection(
            editor.getJSON(),
            selection,
            "link",
          );
          if (!next) return false;
          editor.dispatch({ doc: next, selection, addToHistory: true });
          return true;
        },
    },
    keyboardShortcuts: {
      "Mod-k": (editor) => {
        // Prompt-based fallback. UI layers can replace this by binding
        // their own shortcut to setLink/unsetLink with a richer dialog.
        if (typeof window === "undefined") return false;
        const current = window.prompt("Link URL", "https://");
        if (current == null || current === "") {
          const fn = editor.commands.unsetLink;
          return typeof fn === "function" ? fn() : false;
        }
        const fn = editor.commands.setLink;
        return typeof fn === "function" ? fn({ href: current }) : false;
      },
    },
    configure(o: Record<string, unknown>): Extension {
      return makeExtension({ ...options, ...(o as LinkOptions) });
    },
  };
}

export const LinkExtension: Extension = makeExtension({});
export default LinkExtension;
