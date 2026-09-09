/**
 * Schema compilation.
 *
 * Core registers two built-in node types that every document needs:
 *   - "doc"  — the root container of block nodes
 *   - "text" — the inline text leaf
 *
 * Everything else — paragraph, heading, bold, italic, … — comes from
 * extensions. This file walks the extension list, validates names, and
 * produces a CompiledSchema for fast lookup by name.
 */

import type {
  Extension,
  ExtensionBundle,
  CompiledSchema,
  NodeSpec,
  MarkSpec,
} from "./types.js";

const DOC_NODE: NodeSpec = {
  name: "doc",
  group: "block",
  content: "block+",
  toDOM: () => ["div", { class: "smeditor-doc" }, 0],
};

const TEXT_NODE: NodeSpec = {
  name: "text",
  group: "inline",
  content: "none",
  // text rendering is special-cased by the serializer
  toDOM: () => ["span"],
};

/** Flatten extensions and bundles into a single Extension[] list. */
export function flattenExtensions(
  list: (Extension | ExtensionBundle)[],
): Extension[] {
  const out: Extension[] = [];
  for (const item of list) {
    if (isBundle(item)) {
      out.push(...item.extensions);
    } else {
      out.push(item);
    }
  }
  return out;
}

function isBundle(x: Extension | ExtensionBundle): x is ExtensionBundle {
  return (
    typeof x === "object" &&
    x !== null &&
    Array.isArray((x as ExtensionBundle).extensions)
  );
}

/** Build a CompiledSchema from a flat extension list. */
export function compileSchema(extensions: Extension[]): CompiledSchema {
  const nodes: Record<string, NodeSpec> = {
    doc: DOC_NODE,
    text: TEXT_NODE,
  };
  const marks: Record<string, MarkSpec> = {};

  for (const ext of extensions) {
    if (ext.nodes) {
      for (const n of ext.nodes) {
        if (n.name === "doc" || n.name === "text") {
          throw new Error(
            `[smeditor] extension "${ext.name}" tried to redefine reserved node "${n.name}"`,
          );
        }
        if (nodes[n.name]) {
          throw new Error(
            `[smeditor] duplicate node "${n.name}" registered by extension "${ext.name}"`,
          );
        }
        nodes[n.name] = n;
      }
    }
    if (ext.marks) {
      for (const m of ext.marks) {
        if (marks[m.name]) {
          throw new Error(
            `[smeditor] duplicate mark "${m.name}" registered by extension "${ext.name}"`,
          );
        }
        marks[m.name] = m;
      }
    }
  }

  // Default paragraph fallback: if no paragraph node is registered, the
  // editor would have nowhere to insert plain text. We register a minimal
  // one so headless usage still works. Real apps should include
  // extension-paragraph (or StarterKit).
  if (!nodes.paragraph) {
    nodes.paragraph = {
      name: "paragraph",
      group: "block",
      content: "inline*",
      toDOM: () => ["p", 0],
      parseDOM: [{ tag: "p" }],
    };
  }

  return { nodes, marks };
}
