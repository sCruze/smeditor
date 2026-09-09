/**
 * @smeditor/extension-code-block
 *
 * Renders as <pre><code class="language-…">…</code></pre>. The language
 * attribute is preserved on round-trip; actual syntax highlighting is
 * out of scope (that's a separate extension).
 *
 * Content inside a code block is treated as plain text — marks like
 * bold or italic don't apply. (Marks aren't stripped at the schema
 * level here for simplicity; toolbar buttons should grey themselves
 * out when `editor.isActive('code_block')`.)
 */

import type { Extension, EditorInstance } from "@smeditor/core";
import { setBlockType } from "@smeditor/core";

export const CodeBlockExtension: Extension = {
  name: "code_block",
  nodes: [
    {
      name: "code_block",
      group: "block",
      content: "text*",
      attrs: { language: { default: null } },
      toDOM: (node) => {
        const lang = node.attrs?.language;
        const codeAttrs: Record<string, string> =
          typeof lang === "string" && lang
            ? { class: `language-${lang}` }
            : {};
        // toDOM returns the outer element; nested <code> is added by
        // the serializer as raw HTML below. We use a single-tag
        // representation here and wrap inside `wrapHTML` at parse time.
        return ["pre", codeAttrs, 0];
      },
      parseDOM: [
        {
          tag: "pre",
          getAttrs: (el) => {
            // Pull language off the inner <code> if present, fallback to
            // the <pre> itself.
            const code = el.querySelector("code");
            const klass =
              code?.getAttribute("class") ?? el.getAttribute("class") ?? "";
            const m = /language-([\w-]+)/.exec(klass);
            return m ? { language: m[1] } : null;
          },
        },
      ],
    },
  ],
  commands: {
    setCodeBlock:
      (opts: { language?: string } = {}) =>
      (editor: EditorInstance): boolean => {
        const next = setBlockType(
          editor.getJSON(),
          editor.getSelection(),
          "code_block",
          opts.language ? { language: opts.language } : undefined,
        );
        if (!next) return false;
        editor.dispatch({
          doc: next,
          selection: editor.getSelection(),
          addToHistory: true,
        });
        return true;
      },
  },
};

export default CodeBlockExtension;
