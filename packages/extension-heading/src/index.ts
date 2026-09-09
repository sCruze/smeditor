/**
 * @smeditor/extension-heading
 *
 * H1-H6 sharing one node type with a `level` attribute, plus the
 * optional `textAlign`, `indent` and `lineHeight` attributes.
 */

import type {
  Extension,
  EditorInstance,
  DocumentNode,
  DOMOutputSpec,
} from "@smeditor/core";
import { setBlockType } from "@smeditor/core";

export interface HeadingOptions {
  levels?: number[];
}

const DEFAULT_LEVELS = [1, 2, 3, 4, 5, 6];
const ALIGN_VALUES = new Set(["left", "center", "right", "justify"]);

function buildAttrs(node: DocumentNode): Record<string, string> | null {
  const align = node.attrs?.textAlign;
  const indent = Number(node.attrs?.indent ?? 0);
  const lineHeight = node.attrs?.lineHeight;
  const styles: string[] = [];
  const out: Record<string, string> = {};
  if (typeof align === "string" && ALIGN_VALUES.has(align) && align !== "left") {
    styles.push(`text-align: ${align}`);
  }
  if (typeof lineHeight === "string" && lineHeight) {
    styles.push(`line-height: ${lineHeight}`);
  }
  if (indent > 0) {
    out["data-indent"] = String(indent);
  }
  if (styles.length) out.style = styles.join("; ");
  return Object.keys(out).length ? out : null;
}

function headingToDOM(node: DocumentNode): DOMOutputSpec {
  const level = (node.attrs?.level as number) ?? 1;
  const tag = `h${clamp(level, 1, 6)}`;
  const attrs = buildAttrs(node);
  return attrs ? [tag, attrs, 0] : [tag, 0];
}

function makeExtension(options: HeadingOptions): Extension {
  const levels = options.levels ?? DEFAULT_LEVELS;
  return {
    name: "heading",
    nodes: [
      {
        name: "heading",
        group: "block",
        content: "inline*",
        attrs: {
          level: { default: 1 },
          textAlign: { default: null },
          indent: { default: null },
          lineHeight: { default: null },
        },
        toDOM: headingToDOM,
        parseDOM: levels.map((level) => ({
          tag: `h${level}`,
          getAttrs: (el: HTMLElement) => {
            const style = el.getAttribute("style") ?? "";
            const align = /text-align:\s*(left|center|right|justify)/i.exec(style);
            const lh = /line-height:\s*([^;]+)/i.exec(style);
            const indentRaw = el.getAttribute("data-indent");
            const indent = indentRaw ? Number(indentRaw) || null : null;
            const out: Record<string, unknown> = { level };
            if (align) out.textAlign = align[1].toLowerCase();
            if (lh) out.lineHeight = lh[1].trim();
            if (indent) out.indent = indent;
            return out;
          },
        })),
      },
    ],
    commands: {
      setHeading:
        (opts: { level?: number } = {}) =>
        (editor: EditorInstance): boolean => {
          const level = clamp(opts.level ?? 1, 1, 6);
          const next = setBlockType(
            editor.getJSON(),
            editor.getSelection(),
            "heading",
            { level },
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
    keyboardShortcuts: levels.reduce<Record<string, (editor: EditorInstance) => boolean>>(
      (acc, level) => {
        acc[`Mod-Alt-${level}`] = (editor) => {
          const fn = editor.commands.setHeading;
          return typeof fn === "function" ? fn({ level }) : false;
        };
        return acc;
      },
      {},
    ),
    configure(opts: Record<string, unknown>): Extension {
      return makeExtension({ ...options, ...(opts as HeadingOptions) });
    },
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export const HeadingExtension: Extension = makeExtension({});
export default HeadingExtension;
