/**
 * @smeditor/extension-placeholder
 *
 * Adds a placeholder to an empty editor. This is purely visual — the
 * document model is unchanged. We hook into `onCreate` and the editor's
 * `update`/`selectionUpdate` events to keep a `data-placeholder`
 * attribute in sync on the first empty paragraph.
 *
 * Styling comes from the theme. The default theme already targets
 * `[data-placeholder]::before`. Override that selector for custom
 * looks.
 *
 * Text is taken from `editor.options.placeholder` ("Start typing…" by
 * default) or from the extension's own `configure({ text })`.
 */

import type { Extension, EditorInstance } from "@smeditor/core";

export interface PlaceholderOptions {
  text?: string;
}

const DEFAULT_TEXT = "Start typing…";

function makeExtension(options: PlaceholderOptions): Extension {
  let unsubUpdate: (() => void) | null = null;
  let unsubSelection: (() => void) | null = null;

  const sync = (editor: EditorInstance) => {
    const el = editor.element;
    if (!el) return;
    const firstChild = el.firstElementChild as HTMLElement | null;
    if (!firstChild) return;

    // We consider the editor "empty" when its first (and only) block
    // is empty of text — that matches the common UX of placeholder
    // disappearing the moment the user types anything.
    const json = editor.getJSON();
    const firstBlock = json.content[0];
    const isEmpty =
      json.content.length === 1 &&
      (!firstBlock?.content || firstBlock.content.length === 0);

    const text =
      options.text ?? editor.options.placeholder ?? DEFAULT_TEXT;

    if (isEmpty) {
      firstChild.setAttribute("data-placeholder", text);
    } else {
      firstChild.removeAttribute("data-placeholder");
    }
  };

  return {
    name: "placeholder",
    onCreate(editor) {
      // Initial paint after the editor mounts on the next tick.
      queueMicrotask(() => sync(editor));
      unsubUpdate = editor.on("update", () => sync(editor));
      unsubSelection = editor.on("selectionUpdate", () => sync(editor));
    },
    onDestroy() {
      unsubUpdate?.();
      unsubSelection?.();
      unsubUpdate = null;
      unsubSelection = null;
    },
    configure(o: Record<string, unknown>): Extension {
      return makeExtension({ ...options, ...(o as PlaceholderOptions) });
    },
  };
}

export const PlaceholderExtension: Extension = makeExtension({});
export default PlaceholderExtension;
