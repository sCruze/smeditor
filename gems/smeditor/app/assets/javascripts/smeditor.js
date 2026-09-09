/**
 * smeditor.js — the gem's boot script.
 *
 * The form helper renders, for each editor field:
 *
 *   <div class="smeditor-field">
 *     <input type="hidden" data-smeditor-input value="<saved html>">
 *     <div class="smeditor-mount" data-smeditor data-smeditor-kit="…">
 *   </div>
 *
 * This script finds every mount, attaches a real editor seeded from
 * the hidden field, and writes editor.getHTML() back into that field
 * on every change — so a plain form submit persists the content.
 *
 * The editor itself is the upstream npm packages. The gem ships no
 * editor core; it only wires Rails forms, assets and optional uploads.
 *
 * `bin/rails generate smeditor:install` copies this file into
 * app/javascript/smeditor.js so the host app's bundler (esbuild, rollup,
 * webpack, bun) resolves the @smeditor/* imports from package.json.
 */

import { createRoot } from "react-dom/client";
import { createElement, Fragment, useMemo } from "react";
import {
  useEditor,
  EditorProvider,
  EditorContent,
  Toolbar,
  ToolbarDivider,
  UndoButton,
  RedoButton,
  BlockTypeDropdown,
  ListsDropdown,
  BoldButton,
  ItalicButton,
  UnderlineButton,
  StrikeButton,
  ClearFormattingButton,
  LinkButton,
  AlignDropdown,
  BlockquoteButton,
  CodeBlockButton,
  HorizontalRuleButton,
  ImageButton,
  ImageToolbar,
  TableButton,
  TableToolbar,
  ImageResizer,
  TableColumnResizer,
  TableCellSelection,
  HighlightButton,
  TextColorButton,
  BackgroundColorButton,
  FontFamilyDropdown,
  FontSizeDropdown,
  LineHeightDropdown,
} from "@smeditor/react";
import { StarterKit, ImageExtension } from "@smeditor/starter-kit";
import { FullKit } from "@smeditor/full-kit";
import "@smeditor/theme-default";

function csrfToken() {
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta ? meta.getAttribute("content") : null;
}

/**
 * Posts the file to the Rails upload endpoint. The controller answers
 * with { src, alt, title }, which is exactly the ImageAttrs shape the
 * image extension accepts.
 */
function uploadHandler(uploadUrl) {
  if (!uploadUrl) return undefined;

  return async (file) => {
    const body = new FormData();
    body.append("file", file);

    const headers = {};
    const token = csrfToken();
    if (token) headers["X-CSRF-Token"] = token;

    const response = await fetch(uploadUrl, {
      method: "POST",
      headers,
      body,
      credentials: "same-origin",
    });

    if (!response.ok) {
      throw new Error(`SMEditor upload failed with ${response.status}`);
    }

    return response.json();
  };
}

function kitExtensions(kit, uploadUrl) {
  const base = kit === "full" ? FullKit.extensions : StarterKit.extensions;
  const upload = uploadHandler(uploadUrl);

  if (!upload) return base;

  return base.map((extension) =>
    extension.name === "image"
      ? ImageExtension.configure({ upload })
      : extension,
  );
}

/**
 * Default toolbar. `Toolbar` renders whatever children it is given, so
 * the buttons have to be listed explicitly — an empty `<Toolbar />`
 * produces an empty bar.
 */
function DefaultToolbar({ kit }) {
  const common = [
    createElement(UndoButton, { key: "undo" }),
    createElement(RedoButton, { key: "redo" }),
    createElement(ToolbarDivider, { key: "d1" }),

    createElement(BlockTypeDropdown, { key: "block" }),
    createElement(ListsDropdown, { key: "lists" }),
    createElement(ToolbarDivider, { key: "d2" }),

    createElement(BoldButton, { key: "bold" }),
    createElement(ItalicButton, { key: "italic" }),
    createElement(UnderlineButton, { key: "underline" }),
    createElement(StrikeButton, { key: "strike" }),
    createElement(ClearFormattingButton, { key: "clear" }),
    createElement(LinkButton, { key: "link" }),
    createElement(ToolbarDivider, { key: "d3" }),

    createElement(AlignDropdown, { key: "align" }),
    createElement(ToolbarDivider, { key: "d4" }),

    createElement(BlockquoteButton, { key: "quote" }),
    createElement(CodeBlockButton, { key: "code" }),
    createElement(HorizontalRuleButton, { key: "hr" }),
    createElement(ImageButton, { key: "image" }),
    createElement(TableButton, { key: "table" }),
  ];

  const full =
    kit === "full"
      ? [
          createElement(ToolbarDivider, { key: "d5" }),
          createElement(HighlightButton, { key: "highlight" }),
          createElement(TextColorButton, { key: "color" }),
          createElement(BackgroundColorButton, { key: "bg" }),
          createElement(FontFamilyDropdown, { key: "family" }),
          createElement(FontSizeDropdown, { key: "size" }),
          createElement(LineHeightDropdown, { key: "line" }),
        ]
      : [];

  return createElement(
    Toolbar,
    { ariaLabel: "SMEditor editor toolbar" },
    ...common,
    ...full,
  );
}

/** One mounted editor field. */
function SMEditorField({ mount, input }) {
  const kit = mount.dataset.smeditorKit === "full" ? "full" : "starter";
  const uploadUrl = mount.dataset.smeditorUploadUrl || "";
  const placeholder = mount.dataset.smeditorPlaceholder || undefined;

  const extensions = useMemo(
    () => kitExtensions(kit, uploadUrl),
    [kit, uploadUrl],
  );

  const { editor, version } = useEditor({
    extensions,
    content: input.value || "<p></p>",
    placeholder,
    onUpdate: ({ editor: instance }) => {
      input.value = instance.getHTML();
    },
  });

  // `editor` is null on the first render and `EditorContent` reads the
  // instance from its prop, not from context — both have to be passed
  // explicitly or the editor never mounts to the DOM node.
  return createElement(
    EditorProvider,
    { editor, version },
    createElement(
      "div",
      { className: "smeditor" },
      createElement(DefaultToolbar, { kit }),
      createElement(EditorContent, {
        editor,
        ariaLabel: mount.dataset.smeditorLabel || "Rich text editor",
      }),
      createElement(ImageToolbar, null),
      createElement(TableToolbar, null),
      createElement(ImageResizer, null),
      createElement(TableColumnResizer, null),
      createElement(TableCellSelection, null),
    ),
  );
}

/** Attach editors to every un-booted mount in the document. */
export function boot(root = document) {
  const mounts = root.querySelectorAll("[data-smeditor]");
  mounts.forEach((mount) => {
    if (mount.dataset.smeditorBooted) return;

    const field = mount.closest(".smeditor-field");
    const input = field && field.querySelector("[data-smeditor-input]");
    if (!input) return;

    mount.dataset.smeditorBooted = "1";

    createRoot(mount).render(
      createElement(
        Fragment,
        null,
        createElement(SMEditorField, { mount, input }),
      ),
    );
  });
}

// Auto-boot on load and after Turbo navigations. The readyState check
// matters when the bundle is injected after the document has parsed —
// DOMContentLoaded has already fired by then and would never call boot.
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => boot());
  } else {
    boot();
  }
  document.addEventListener("turbo:load", () => boot());
  document.addEventListener("turbo:frame-load", (event) => {
    boot(event.target || document);
  });
}

// Re-exported so a host app can build a custom integration instead of auto-boot.
export * from "@smeditor/react";
export { StarterKit, ImageExtension } from "@smeditor/starter-kit";
export { FullKit } from "@smeditor/full-kit";
