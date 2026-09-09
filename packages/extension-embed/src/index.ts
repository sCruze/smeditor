/**
 * @smeditor/extension-embed
 *
 * Embed external media (YouTube / Vimeo / a generic allowlisted https
 * iframe) as a block-level *atom* node — the equivalent of Tiptap's
 * Youtube node or CKEditor's media-embed feature.
 *
 * SECURITY: this extension deliberately ships a *strict* allowlist. Only
 * iframes whose `src` is a normalised YouTube / Vimeo embed URL, or an
 * https URL on an explicitly allowlisted host, are ever rendered or
 * parsed. Everything else (javascript: URLs, arbitrary third-party
 * sites, http://, data:, …) is rejected — `normalizeEmbedSrc` returns
 * `null` and the node renders an empty placeholder / the parser drops
 * it. The iframe is additionally rendered with a restrictive `sandbox`
 * attribute.
 *
 * The node is an "atom": it has no editable content, only attributes,
 * and the parser does not descend into its inner DOM.
 */

import type {
  Extension,
  EditorInstance,
  DocumentNode,
  DocumentJSON,
  DOMOutputSpec,
} from "@smeditor/core";
import { cloneDoc, sanitizeURL } from "@smeditor/core";

export interface EmbedAttrs {
  src: string;
  width?: number;
  height?: number;
}

const DEFAULT_WIDTH = 560;
const DEFAULT_HEIGHT = 315;

/**
 * Hosts that are accepted directly (when a URL is not a recognised
 * YouTube / Vimeo watch URL). Kept intentionally tiny — only the embed
 * players of the two supported providers.
 */
const ALLOWED_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
  "player.vimeo.com",
]);

/** YouTube video ids are 11 chars today, but accept a tolerant range. */
const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,15}$/;
const VIMEO_ID = /^\d+$/;

/**
 * Normalise a raw embed URL into a safe, allowlisted iframe `src`.
 *
 * - YouTube watch / short / embed URLs collapse to the canonical
 *   `https://www.youtube.com/embed/VIDEO_ID` form.
 * - Vimeo `https://vimeo.com/NUMBER` collapses to
 *   `https://player.vimeo.com/video/NUMBER`.
 * - Any other https URL is accepted only when its host is in the
 *   allowlist (after passing `sanitizeURL` with `protocols: ["https"]`).
 *
 * Returns `null` for anything that is not provably safe.
 */
export function normalizeEmbedSrc(raw: unknown): string | null {
  if (raw == null) return null;
  const value = String(raw).trim();
  if (!value) return null;

  // First gate everything through the shared URL sanitizer, restricted to
  // https. This rejects javascript:, data:, vbscript:, http://, control
  // characters, etc. before we ever look at the host.
  const safe = sanitizeURL(value, {
    protocols: ["https"],
    allowRelative: false,
    allowFragments: false,
  });
  if (!safe) return null;

  let url: URL;
  try {
    url = new URL(safe);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();

  // --- YouTube -----------------------------------------------------------
  if (host === "youtu.be") {
    const id = url.pathname.slice(1);
    return YOUTUBE_ID.test(id) ? `https://www.youtube.com/embed/${id}` : null;
  }
  if (
    host === "youtube.com" ||
    host === "www.youtube.com" ||
    host === "m.youtube.com" ||
    host === "youtube-nocookie.com" ||
    host === "www.youtube-nocookie.com"
  ) {
    // /watch?v=ID
    if (url.pathname === "/watch") {
      const id = url.searchParams.get("v") ?? "";
      return YOUTUBE_ID.test(id)
        ? `https://www.youtube.com/embed/${id}`
        : null;
    }
    // /embed/ID (already embed form) or /shorts/ID
    const embedMatch = /^\/embed\/([^/?#]+)/.exec(url.pathname);
    if (embedMatch && YOUTUBE_ID.test(embedMatch[1])) {
      return `https://www.youtube.com/embed/${embedMatch[1]}`;
    }
    const shortsMatch = /^\/shorts\/([^/?#]+)/.exec(url.pathname);
    if (shortsMatch && YOUTUBE_ID.test(shortsMatch[1])) {
      return `https://www.youtube.com/embed/${shortsMatch[1]}`;
    }
    return null;
  }

  // --- Vimeo -------------------------------------------------------------
  if (host === "vimeo.com" || host === "www.vimeo.com") {
    const id = url.pathname.replace(/^\/+/, "").split("/")[0] ?? "";
    return VIMEO_ID.test(id)
      ? `https://player.vimeo.com/video/${id}`
      : null;
  }
  if (host === "player.vimeo.com") {
    const match = /^\/video\/(\d+)/.exec(url.pathname);
    return match ? `https://player.vimeo.com/video/${match[1]}` : null;
  }

  // --- Generic allowlisted host -----------------------------------------
  return ALLOWED_HOSTS.has(host) ? safe : null;
}

function sanitizeDimension(value: unknown, fallback: number): number {
  if (value == null) return fallback;
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number >= 1 && number <= 4000
    ? number
    : fallback;
}

function embedToDOM(node: DocumentNode): DOMOutputSpec {
  const attrs = (node.attrs ?? {}) as Partial<EmbedAttrs>;
  const src = normalizeEmbedSrc(attrs.src);
  if (!src) {
    // Unsafe / missing src — render an inert placeholder, never an iframe.
    return ["div", { class: "smeditor-embed" }];
  }
  const width = sanitizeDimension(attrs.width, DEFAULT_WIDTH);
  const height = sanitizeDimension(attrs.height, DEFAULT_HEIGHT);
  return [
    "div",
    { class: "smeditor-embed" },
    [
      "iframe",
      {
        src,
        width: String(width),
        height: String(height),
        loading: "lazy",
        allowfullscreen: true,
        sandbox: "allow-scripts allow-same-origin allow-presentation",
        frameborder: "0",
      },
    ],
  ];
}

function isEmptyBlock(node: DocumentNode | undefined): boolean {
  return Boolean(
    node &&
      (!node.content ||
        node.content.length === 0 ||
        (node.content.length === 1 &&
          node.content[0].type === "text" &&
          (node.content[0].text ?? "") === "")),
  );
}

/**
 * Build the embed node attrs from validated input, or `null` when the
 * src cannot be normalised.
 */
function buildAttrs(opts: Partial<EmbedAttrs> | undefined): EmbedAttrs | null {
  const src = normalizeEmbedSrc(opts?.src);
  if (!src) return null;
  const out: EmbedAttrs = { src };
  if (opts?.width != null) {
    out.width = sanitizeDimension(opts.width, DEFAULT_WIDTH);
  }
  if (opts?.height != null) {
    out.height = sanitizeDimension(opts.height, DEFAULT_HEIGHT);
  }
  return out;
}

function insertEmbedBlock(
  editor: EditorInstance,
  opts: Partial<EmbedAttrs> | undefined,
): boolean {
  const attrs = buildAttrs(opts);
  if (!attrs) return false;

  const sel = editor.getSelection();
  const idx = sel?.anchor.path[0] ?? 0;
  const doc: DocumentJSON = cloneDoc(editor.getJSON());

  const embedNode: DocumentNode = { type: "embed", attrs: { ...attrs } };
  const trailing: DocumentNode = { type: "paragraph" };

  const current = doc.content[idx];
  let caretIdx: number;
  if (isEmptyBlock(current)) {
    doc.content.splice(idx, 1, embedNode, trailing);
    caretIdx = idx + 1;
  } else {
    doc.content.splice(idx + 1, 0, embedNode, trailing);
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
}

export const EmbedExtension: Extension = {
  name: "embed",
  nodes: [
    {
      name: "embed",
      group: "block",
      content: "",
      atom: true,
      attrs: {
        src: { default: null },
        width: { default: DEFAULT_WIDTH },
        height: { default: DEFAULT_HEIGHT },
      },
      toDOM: embedToDOM,
      parseDOM: [
        {
          // Match any iframe and accept it only if its src normalises to
          // an allowlisted embed URL. An unsafe src returns false, so the
          // parser skips the node entirely (the iframe is dropped).
          tag: "iframe",
          getAttrs: (el) => {
            const src = normalizeEmbedSrc(el.getAttribute("src"));
            if (!src) return false;
            const out: Record<string, unknown> = { src };
            const width = el.getAttribute("width");
            const height = el.getAttribute("height");
            if (width != null) out.width = sanitizeDimension(width, DEFAULT_WIDTH);
            if (height != null) {
              out.height = sanitizeDimension(height, DEFAULT_HEIGHT);
            }
            return out;
          },
        },
      ],
    },
  ],
  commands: {
    /**
     * insertEmbed({ src, width?, height? }) — inserts an embed block.
     * The src is normalised against the allowlist; an invalid / unsafe
     * src inserts nothing and returns false. Mirrors the image insert:
     * replaces the current empty block, otherwise inserts after it with
     * a trailing paragraph for the caret.
     */
    insertEmbed:
      (opts: Partial<EmbedAttrs>) =>
      (editor: EditorInstance): boolean =>
        insertEmbedBlock(editor, opts),

    /** insertYoutube({ src }) — alias for insertEmbed. */
    insertYoutube:
      (opts: { src: string }) =>
      (editor: EditorInstance): boolean =>
        insertEmbedBlock(editor, opts),
  },
};

export default EmbedExtension;
