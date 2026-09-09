/**
 * useEditor — Vue 3 composable around `createEditor`.
 *
 * Returns a `shallowRef` holding the live `EditorInstance` (or `null`
 * before creation / after teardown) and keeps it in sync with the
 * configured extension set. The instance is stable while the extension
 * set is stable. When a host switches bundles (for example
 * StarterKit → FullKit), the composable recreates the editor with the
 * current document and remounts it to the same DOM node so newly
 * available toolbar commands start working.
 *
 * Mirrors `@smeditor/react`'s `useEditor`, but idiomatic Vue: editor
 * creation happens in `onMounted` (client only), recreation is driven by
 * a `watch` on a stable extension signature, and teardown happens in
 * `onBeforeUnmount`.
 */

import {
  onBeforeUnmount,
  onMounted,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type ShallowRef,
} from "vue";
import { createEditor } from "@smeditor/core";
import type {
  DocumentJSON,
  EditorInstance,
  EditorOptions,
  Extension,
  ExtensionBundle,
} from "@smeditor/core";

export interface UseEditorOptions extends Omit<EditorOptions, "element"> {
  /**
   * Element (or a ref/getter resolving to one) the editor mounts to.
   * When omitted, the editor is created headless and the host can mount
   * it later via `editor.value.mount(el)` (this is what the `Editor` and
   * `EditorContent` components do internally).
   */
  element?: MaybeRefOrGetter<HTMLElement | null | undefined>;
}

export interface UseEditorResult {
  /** The live editor instance, or `null` before creation / after teardown. */
  editor: ShallowRef<EditorInstance | null>;
}

export function useEditor(options: UseEditorOptions): UseEditorResult {
  const editor: ShallowRef<EditorInstance | null> = shallowRef(null);

  // Read the latest options/callbacks lazily. When the host passes a
  // reactive options object (or, like the `Editor` component, an object
  // of getters over props), reads through `currentOptions` always see
  // the current values without re-creating the editor.
  const currentOptions = options;

  // Carries the live document across a teardown so the next instance
  // (an extension-set swap) resumes from where the last one left off.
  let carryContent: EditorOptions["content"] = undefined;

  let lastExtensionSig = extensionSignature(options.extensions ?? []);
  let lastContentSig = contentSignature(options.content);

  const create = (
    contentOverride?: EditorOptions["content"],
  ): EditorInstance => {
    const { element: _element, ...editorOptions } = currentOptions;

    const instance = createEditor({
      ...editorOptions,
      ...(contentOverride !== undefined ? { content: contentOverride } : {}),
      // Default deep selection ON for the framework binding: it's what
      // makes list Enter/Tab, table cell navigation and markdown-in-cells
      // work out of the box. Headless `createEditor` keeps it off by
      // default for backward compatibility; a host can still opt out.
      deepSelection: currentOptions.deepSelection ?? true,
      // Forward callbacks through stable closures that read the latest
      // host callbacks.
      onUpdate: (ctx) => currentOptions.onUpdate?.(ctx),
      onSelectionUpdate: (ctx) => currentOptions.onSelectionUpdate?.(ctx),
      onCreate: (ctx) => currentOptions.onCreate?.(ctx),
      onFocus: (ctx) => currentOptions.onFocus?.(ctx),
      onBlur: (ctx) => currentOptions.onBlur?.(ctx),
      onTransaction: (ctx) => currentOptions.onTransaction?.(ctx),
      onDestroy: (ctx) => currentOptions.onDestroy?.(ctx),
    });

    const el = currentOptions.element
      ? toValue(currentOptions.element)
      : null;
    if (el) instance.mount(el);

    return instance;
  };

  const teardown = () => {
    const instance = editor.value;
    if (!instance) return;
    carryContent = instance.getJSON();
    instance.destroy();
    editor.value = null;
  };

  // Create on mount (client only — onMounted does not run on the server).
  onMounted(() => {
    editor.value = create(carryContent);
    lastContentSig = contentSignature(currentOptions.content);
  });

  // Mount the editor when a deferred element ref resolves after creation
  // (e.g. the host wires `element` to a template ref populated on mount).
  const elementSource = options.element;
  if (elementSource) {
    watch(
      () => toValue(elementSource),
      (el) => {
        if (el && editor.value && !editor.value.element) {
          editor.value.mount(el);
        }
      },
    );
  }

  // Recreate only when the extension set changes (StarterKit ↔ FullKit),
  // carrying the current document over so newly available commands work.
  watch(
    () => extensionSignature(currentOptions.extensions ?? []),
    (nextSig) => {
      if (nextSig === lastExtensionSig) return;
      lastExtensionSig = nextSig;
      // Skip if not yet created (onMounted handles first creation).
      if (!editor.value) return;
      teardown();
      editor.value = create(carryContent);
      lastContentSig = contentSignature(currentOptions.content);
    },
  );

  // Push external content changes into the live editor (when the host
  // changes `content` without swapping extensions).
  watch(
    () => contentSignature(currentOptions.content),
    (nextSig) => {
      if (nextSig === lastContentSig) return;
      lastContentSig = nextSig;
      if (currentOptions.content === undefined) return;
      editor.value?.setContent(currentOptions.content);
    },
  );

  onBeforeUnmount(teardown);

  return { editor };
}

// ---------------------------------------------------------------------------
// Signatures — identical strategy to the React binding.
// ---------------------------------------------------------------------------

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
