/**
 * useEditor — React hook around `createEditor`.
 *
 * Returns an EditorInstance and keeps React state in sync with editor
 * updates. The instance is stable while the configured extension set is
 * stable. When a host switches bundles (for example StarterKit → FullKit),
 * the hook recreates the editor with the current document and remounts it
 * to the same DOM node so newly available toolbar commands start working.
 */

import { useEffect, useRef, useState } from "react";
import { createEditor } from "@smeditor/core";
import type {
  DocumentJSON,
  EditorInstance,
  EditorOptions,
  Extension,
  ExtensionBundle,
} from "@smeditor/core";

export interface UseEditorOptions
  extends Omit<EditorOptions, "element"> {
  /** When false, the editor is destroyed and recreated. Default: true. */
  immediatelyRender?: boolean;
}

export interface UseEditorResult {
  editor: EditorInstance | null;
  /** Bumps on every update / selectionUpdate; use as a dep to re-derive UI. */
  version: number;
}

export function useEditor(options: UseEditorOptions): UseEditorResult {
  const optionsRef = useRef(options);
  // Always pick up the latest callbacks without re-creating the editor.
  optionsRef.current = options;

  const extensionSig = extensionSignature(options.extensions ?? []);
  const contentSig = contentSignature(options.content);
  const contentSigRef = useRef(contentSig);
  // Live instance, mirrored into state so consumers re-render when it
  // changes. The ref is for synchronous reads (the content effect).
  const editorRef = useRef<EditorInstance | null>(null);
  // Carries the live document across a teardown so the next instance
  // (a React 18 StrictMode re-setup, or an extension-set swap) resumes
  // from where the last one left off.
  const carryContentRef = useRef<EditorOptions["content"]>(undefined);
  const [editor, setEditor] = useState<EditorInstance | null>(null);
  const [version, setVersion] = useState(0);

  const createEditorWithCallbacks = (
    contentOverride?: EditorOptions["content"],
  ): EditorInstance =>
    createEditor({
      ...optionsRef.current,
      ...(contentOverride !== undefined ? { content: contentOverride } : {}),
      // Default deep selection ON for the React path: it's what makes
      // list Enter/Tab, table cell navigation and markdown-in-cells work
      // out of the box. Headless `createEditor` keeps it off by default
      // for backward compatibility; a host can still opt out explicitly.
      deepSelection: optionsRef.current.deepSelection ?? true,
      // Forward callbacks through a stable closure so React state stays in sync.
      onUpdate: (ctx) => {
        optionsRef.current.onUpdate?.(ctx);
        setVersion((v) => v + 1);
      },
      onSelectionUpdate: (ctx) => {
        optionsRef.current.onSelectionUpdate?.(ctx);
        setVersion((v) => v + 1);
      },
      onCreate: (ctx) => {
        optionsRef.current.onCreate?.(ctx);
        setVersion((v) => v + 1);
      },
      onFocus: (ctx) => {
        optionsRef.current.onFocus?.(ctx);
      },
      onBlur: (ctx) => {
        optionsRef.current.onBlur?.(ctx);
      },
      onTransaction: (ctx) => {
        optionsRef.current.onTransaction?.(ctx);
      },
      onDestroy: (ctx) => {
        optionsRef.current.onDestroy?.(ctx);
      },
    });

  // Create the editor inside an effect (not during render), keyed on the
  // extension signature. This is what survives React 18 StrictMode, which
  // runs effects setup → cleanup → setup without re-rendering: the cleanup
  // destroys the instance and the second setup builds a fresh one, both
  // flowing through state so EditorContent re-mounts the live editor. The
  // same effect handles an extension-set swap (StarterKit ↔ FullKit),
  // carrying the current document over so newly available commands work.
  useEffect(() => {
    const next = createEditorWithCallbacks(carryContentRef.current);
    editorRef.current = next;
    contentSigRef.current = contentSignature(optionsRef.current.content);
    setEditor(next);
    setVersion((v) => v + 1);
    return () => {
      carryContentRef.current = next.getJSON();
      next.destroy();
      editorRef.current = null;
      setEditor(null);
    };
    // Recreate only when the extension set changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extensionSig]);

  // Push external content changes into the live editor (when the host
  // changes the `content` prop without swapping extensions).
  useEffect(() => {
    if (contentSigRef.current === contentSig) return;
    contentSigRef.current = contentSig;
    if (options.content === undefined) return;

    editorRef.current?.setContent(options.content);
  }, [contentSig, options.content]);

  return { editor, version };
}

const extensionIds = new WeakMap<object, number>();
let nextExtensionId = 1;

function extensionSignature(
  extensions: Array<Extension | ExtensionBundle>,
): string {
  return extensions.map(extensionPartSignature).join("|");
}

function extensionPartSignature(ext: Extension | ExtensionBundle): string {
  const id = extensionId(ext);
  const maybeBundle = ext as ExtensionBundle;
  if (Array.isArray(maybeBundle.extensions)) {
    return `${id}:${maybeBundle.name ?? "bundle"}(${maybeBundle.extensions
      .map(extensionPartSignature)
      .join(",")})`;
  }

  const extension = ext as Extension;
  return [
    `${id}:${extension.name ?? "extension"}`,
    Object.keys(extension.commands ?? {}).join(","),
    (extension.nodes ?? []).map((node) => node.name).join(","),
    (extension.marks ?? []).map((mark) => mark.name).join(","),
  ].join("#");
}

function extensionId(ext: Extension | ExtensionBundle): number {
  const current = extensionIds.get(ext);
  if (current) return current;

  const next = nextExtensionId++;
  extensionIds.set(ext, next);
  return next;
}

function contentSignature(content: EditorOptions["content"]): string {
  if (content === undefined) return "unset";
  if (typeof content === "string") return `html:${content}`;

  return `json:${stableStringify(content)}`;
}

function stableStringify(content: DocumentJSON): string {
  try {
    return JSON.stringify(content);
  } catch {
    return String(content);
  }
}
