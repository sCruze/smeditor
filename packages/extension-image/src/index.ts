/**
 * @smeditor/extension-image
 *
 * Block-level image node. Covers the MVP slice of §9 of the brief:
 * insert by URL, insert via extension-configured upload handler, paste/drop
 * image files from the React surface, alt/title metadata, dimensions and
 * left / center / right alignment.
 *
 * The upload itself remains the host app's job. Configure the extension with
 * `ImageExtension.configure({ upload })`; SMEditor only calls the handler and
 * inserts the returned safe URL.
 *
 * Deliberately *not* in this version: drag-resize handles, captions as editable
 * child nodes, inline (text-flow) images, embeds. Those need a resize-handle UI
 * and the figure/figcaption node pair — scheduled for a later iteration.
 *
 * The node is "void": it has no editable content, only attributes.
 */

import type {
  Extension,
  EditorInstance,
  DocumentNode,
  DocumentJSON,
  DOMOutputSpec,
} from "@smeditor/core";
import { cloneDoc, nodeAt, sanitizeURL } from "@smeditor/core";

export type ImageAlign = "left" | "center" | "right";

export interface ImageAttrs {
  src: string;
  alt?: string;
  title?: string;
  align?: ImageAlign;
  width?: number | null;
  height?: number | null;
  caption?: string | null;
}

export type ImageUploadResult = string | ImageAttrs | null | undefined;
export type ImageUploadHandler = (file: File) => Promise<ImageUploadResult>;

export interface ImageExtensionOptions {
  /** Allowed URL protocols for absolute image URLs. Defaults to http/https. */
  protocols?: string[];
  /** Allow safe raster data URLs. SVG data URLs are always rejected. */
  allowDataUrls?: boolean;
  /** Maximum accepted data URL length. Defaults to roughly 2MB. */
  maxDataUrlLength?: number;
  /** Optional host-provided upload handler for paste/drop/file uploads. */
  upload?: ImageUploadHandler;
  /** Optional upload error hook. */
  onUploadError?: (error: unknown) => void;
}

const ALIGN_VALUES = new Set<ImageAlign>(["left", "center", "right"]);
const DEFAULT_PROTOCOLS = ["http", "https"];
const DEFAULT_MAX_DATA_URL_LENGTH = 2_000_000;
const RASTER_DATA_URL = /^data:image\/(?:png|jpe?g|gif|webp|avif|bmp);base64,[a-z0-9+/=\s]+$/i;

function makeExtension(options: ImageExtensionOptions = {}): Extension {
  const protocols = normaliseProtocols(options.protocols ?? DEFAULT_PROTOCOLS);
  const allowDataUrls = options.allowDataUrls ?? true;
  const maxDataUrlLength =
    typeof options.maxDataUrlLength === "number" && options.maxDataUrlLength > 0
      ? options.maxDataUrlLength
      : DEFAULT_MAX_DATA_URL_LENGTH;

  const sanitizeSrc = (raw: unknown): string | null =>
    sanitizeURL(raw, {
      protocols: [...protocols],
      allowFragments: false,
      allowDataUrls,
      dataUrlPattern: RASTER_DATA_URL,
      maxDataUrlLength,
    });

  const normaliseAttrs = (attrs: Partial<ImageAttrs>): ImageAttrs | null => {
    const src = sanitizeSrc(attrs.src);
    if (!src) return null;

    const out: ImageAttrs = { src };
    if (typeof attrs.alt === "string" && attrs.alt) out.alt = attrs.alt;
    if (typeof attrs.title === "string" && attrs.title) out.title = attrs.title;
    if (attrs.align && ALIGN_VALUES.has(attrs.align)) out.align = attrs.align;

    const width = sanitizeDimension(attrs.width);
    if (width !== null) out.width = width;
    const height = sanitizeDimension(attrs.height);
    if (height !== null) out.height = height;

    if (typeof attrs.caption === "string" && attrs.caption.trim()) {
      out.caption = attrs.caption.trim();
    }

    return out;
  };

  const imageToDOM = (node: DocumentNode): DOMOutputSpec => {
    const attrs = normaliseAttrs((node.attrs ?? {}) as Partial<ImageAttrs>);
    const imgAttrs: Record<string, string> = { class: "smeditor-image" };
    if (attrs) {
      imgAttrs.src = attrs.src;
      if (attrs.alt) imgAttrs.alt = attrs.alt;
      if (attrs.title) imgAttrs.title = attrs.title;
      if (attrs.width) imgAttrs.width = String(attrs.width);
      if (attrs.height) imgAttrs.height = String(attrs.height);
    }

    const align = attrs?.align;
    const caption = attrs?.caption ?? "";

    if (caption) {
      const figAttrs: Record<string, string> = { class: "smeditor-figure" };
      if (align) figAttrs["data-align"] = align;
      return [
        "figure",
        figAttrs,
        ["img", imgAttrs],
        ["figcaption", { class: "smeditor-figcaption" }, caption],
      ];
    }

    if (align) imgAttrs["data-align"] = align;
    return ["img", imgAttrs];
  };

  const imgAttrsFrom = (el: HTMLElement): Record<string, unknown> | false => {
    const attrs = normaliseAttrs({
      src: el.getAttribute("src") ?? "",
      alt: el.getAttribute("alt") ?? undefined,
      title: el.getAttribute("title") ?? undefined,
      align: readAlign(el.getAttribute("data-align")),
      width: readDimension(el.getAttribute("width")),
      height: readDimension(el.getAttribute("height")),
    });
    return attrs ? { ...attrs } : false;
  };

  const commands: NonNullable<Extension["commands"]> = {
    /**
     * insertImage({ src, alt?, title?, width?, height?, align? }) — inserts an
     * image block. If the current block is empty it's replaced; otherwise the
     * image goes right after it, followed by an empty paragraph for the caret.
     */
    insertImage:
      (opts: ImageAttrs) =>
      (editor: EditorInstance): boolean => {
        const attrs = normaliseAttrs(opts ?? {});
        if (!attrs) return false;
        const sel = editor.getSelection();
        const idx = sel?.anchor.path[0] ?? 0;
        const doc: DocumentJSON = cloneDoc(editor.getJSON());

        const imageNode: DocumentNode = { type: "image", attrs: { ...attrs } };
        const trailing: DocumentNode = { type: "paragraph" };

        const current = doc.content[idx];
        const currentEmpty =
          current &&
          (!current.content ||
            current.content.length === 0 ||
            (current.content.length === 1 &&
              current.content[0].type === "text" &&
              (current.content[0].text ?? "") === ""));

        let caretIdx: number;
        if (currentEmpty) {
          doc.content.splice(idx, 1, imageNode, trailing);
          caretIdx = idx + 1;
        } else {
          doc.content.splice(idx + 1, 0, imageNode, trailing);
          caretIdx = idx + 2;
        }

        editor.dispatch({
          doc,
          selection: {
            anchor: { path: [caretIdx], offset: 0 },
            head: { path: [caretIdx], offset: 0 },
          },
          addToHistory: true,
        });
        return true;
      },

    /** setImageAlign({ align }) — re-aligns the image under the caret. */
    setImageAlign:
      (opts: { align: ImageAlign }) =>
      (editor: EditorInstance): boolean => {
        const align = readAlign(opts?.align);
        if (!align) return false;
        const sel = editor.getSelection();
        if (!sel) return false;
        const doc = cloneDoc(editor.getJSON());
        const block = nodeAt(doc, sel.anchor.path);
        if (!block || block.type !== "image") return false;
        block.attrs = { ...(block.attrs ?? {}), align };
        editor.dispatch({ doc, selection: sel, addToHistory: true });
        return true;
      },

    /** updateImageAttrs({ alt?, title?, src?, width?, height?, caption? }) — edit image metadata. */
    updateImageAttrs:
      (opts: Partial<ImageAttrs>) =>
      (editor: EditorInstance): boolean => {
        const sel = editor.getSelection();
        if (!sel) return false;
        const doc = cloneDoc(editor.getJSON());
        const block = nodeAt(doc, sel.anchor.path);
        if (!block || block.type !== "image") return false;
        const attrs = { ...(block.attrs ?? {}) };

        if (opts.alt !== undefined) attrs.alt = opts.alt;
        if (opts.title !== undefined) attrs.title = opts.title;
        if (opts.src !== undefined) {
          const src = sanitizeSrc(opts.src);
          if (!src) return false;
          attrs.src = src;
        }
        if (opts.align !== undefined) {
          const align = readAlign(opts.align);
          if (align) attrs.align = align;
        }
        if (opts.width !== undefined) {
          applyDimensionAttr(attrs, "width", opts.width);
        }
        if (opts.height !== undefined) {
          applyDimensionAttr(attrs, "height", opts.height);
        }
        if (opts.caption !== undefined) {
          const text = opts.caption ? String(opts.caption).trim() : "";
          if (text) attrs.caption = text;
          else delete attrs.caption;
        }

        block.attrs = attrs;
        editor.dispatch({ doc, selection: sel, addToHistory: true });
        return true;
      },

    /** removeImage() — deletes the image block under the caret. */
    removeImage:
      () =>
      (editor: EditorInstance): boolean => {
        const sel = editor.getSelection();
        if (!sel) return false;
        const idx = sel.anchor.path[0] ?? 0;
        const doc = cloneDoc(editor.getJSON());
        const block = doc.content[idx];
        if (!block || block.type !== "image") return false;
        doc.content.splice(idx, 1);
        if (doc.content.length === 0) {
          doc.content.push({ type: "paragraph" });
        }
        const caretIdx = Math.max(0, idx - 1);
        editor.dispatch({
          doc,
          selection: {
            anchor: { path: [caretIdx], offset: 0 },
            head: { path: [caretIdx], offset: 0 },
          },
          addToHistory: true,
        });
        return true;
      },
  };

  if (options.upload) {
    commands.uploadImage =
      (file: File) =>
      (editor: EditorInstance): boolean => {
        if (!isImageFile(file)) return false;
        const selection = editor.getSelection();
        void options
          .upload!(file)
          .then((result) => normaliseUploadResult(result, file))
          .then((attrs) => {
            if (!attrs) return;
            if (selection) editor.setSelection(selection);
            editor.commands.insertImage?.(attrs);
          })
          .catch((error) => {
            if (options.onUploadError) {
              options.onUploadError(error);
            } else if (typeof console !== "undefined") {
              console.error("SMEditor image upload failed:", error);
            }
          });
        return true;
      };
  }

  return {
    name: "image",
    nodes: [
      {
        name: "image",
        group: "block",
        content: "",
        atom: true,
        attrs: {
          src: { default: "" },
          alt: { default: null },
          title: { default: null },
          align: { default: null },
          width: { default: null },
          height: { default: null },
          caption: { default: null },
        },
        toDOM: imageToDOM,
        parseDOM: [
          {
            tag: "img",
            getAttrs: (el) => {
              if (el.closest("figure")) return false;
              return imgAttrsFrom(el);
            },
          },
          {
            tag: "figure",
            getAttrs: (el) => {
              const img = el.querySelector("img");
              if (!img) return false;
              const base = imgAttrsFrom(img as HTMLElement);
              if (!base) return false;
              const align = readAlign(el.getAttribute("data-align"));
              if (align) base.align = align;
              const cap = el.querySelector("figcaption");
              const text = cap?.textContent?.trim();
              if (text) base.caption = text;
              return base;
            },
          },
        ],
      },
    ],
    commands,
    configure(opts: Record<string, unknown>): Extension {
      return makeExtension({ ...options, ...(opts as ImageExtensionOptions) });
    },
  };

  function normaliseUploadResult(
    result: ImageUploadResult,
    file: File,
  ): ImageAttrs | null {
    const attrs =
      typeof result === "string"
        ? { src: result, alt: file.name }
        : result
          ? { alt: file.name, ...result }
          : null;
    return attrs ? normaliseAttrs(attrs) : null;
  }
}

function normaliseProtocols(protocols: string[]): Set<string> {
  return new Set(
    protocols
      .map((protocol) => protocol.trim().replace(/:$/, "").toLowerCase())
      .filter(Boolean),
  );
}

function readAlign(value: unknown): ImageAlign | undefined {
  return typeof value === "string" && ALIGN_VALUES.has(value as ImageAlign)
    ? (value as ImageAlign)
    : undefined;
}

function readDimension(value: unknown): number | null {
  if (typeof value === "number") return sanitizeDimension(value);
  if (typeof value !== "string") return null;
  return sanitizeDimension(Number(value));
}

function sanitizeDimension(value: unknown): number | null {
  if (value == null) return null;
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number >= 1 && number <= 4000
    ? number
    : null;
}

function applyDimensionAttr(
  attrs: Record<string, unknown>,
  key: "width" | "height",
  value: unknown,
): void {
  if (value === null || value === "") {
    delete attrs[key];
    return;
  }
  const next = sanitizeDimension(value);
  if (next !== null) attrs[key] = next;
}

function isImageFile(file: File | undefined): boolean {
  return Boolean(file && /^image\//i.test(file.type));
}

export const ImageExtension: Extension = makeExtension({});
export default ImageExtension;
