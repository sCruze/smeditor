/**
 * @smeditor/extension-emoji
 *
 * Emoji shortcodes. Typing a recognised `:shortcode:` (e.g. `:smile:`)
 * autoreplaces it with the matching emoji character, mirroring the
 * Tiptap / CKEditor emoji feature.
 *
 * This package is headless: it contributes an input rule and an
 * `insertEmoji` command, and exports the `EMOJI` shortcode map plus an
 * `emojiForShortcode` helper. A React picker is built separately on top
 * of the same map.
 *
 * Implementation note: the input rule fires from `editor`'s input-rule
 * engine, which hands the handler the editor plus the regex match. The
 * handler looks the shortcode up in `EMOJI` and, when found, replaces
 * the typed `:name:` span with a single emoji text node — the same
 * mid-text replace pattern the markdown inline rules use
 * (`replaceInlineRange` over the visible range up to the caret).
 */

import type {
  Extension,
  EditorInstance,
  InputRule,
  DocumentNode,
} from "@smeditor/core";
import {
  cloneDoc,
  nodeAt,
  replaceInlineRange,
  insertInlineAt,
} from "@smeditor/core";

/**
 * Shortcode → emoji character map. Keys are the bare shortcode names
 * (without the surrounding colons). ~60 of the most common shortcodes,
 * matching the names GitHub / Slack / Tiptap use.
 */
export const EMOJI: Record<string, string> = {
  // Faces
  smile: "😄",
  smiley: "😃",
  grin: "😁",
  laughing: "😆",
  joy: "😂",
  rofl: "🤣",
  wink: "😉",
  blush: "😊",
  heart_eyes: "😍",
  thinking: "🤔",
  neutral_face: "😐",
  expressionless: "😑",
  sob: "😭",
  rage: "😡",
  sunglasses: "😎",
  scream: "😱",
  // Symbols / objects
  tada: "🎉",
  fire: "🔥",
  star: "⭐",
  sparkles: "✨",
  rocket: "🚀",
  eyes: "👀",
  // Hands
  wave: "👋",
  clap: "👏",
  pray: "🙏",
  muscle: "💪",
  ok_hand: "👌",
  v: "✌️",
  point_right: "👉",
  raised_hands: "🙌",
  // Hearts
  heart: "❤️",
  broken_heart: "💔",
  yellow_heart: "💛",
  green_heart: "💚",
  blue_heart: "💙",
  purple_heart: "💜",
  // Marks
  "100": "💯",
  check: "✅",
  x: "❌",
  warning: "⚠️",
  question: "❓",
  exclamation: "❗",
  bulb: "💡",
  zap: "⚡",
  // Nature
  snowflake: "❄️",
  sun: "☀️",
  moon: "🌙",
  cloud: "☁️",
  // Food & drink
  coffee: "☕",
  beer: "🍺",
  pizza: "🍕",
  cake: "🎂",
  gift: "🎁",
  // Things
  bell: "🔔",
  lock: "🔒",
  key: "🔑",
  mag: "🔍",
  computer: "💻",
  phone: "📱",
  email: "📧",
  calendar: "📅",
  // Reactions
  thumbsup: "👍",
  thumbsdown: "👎",
  "+1": "👍",
  "-1": "👎",
  poop: "💩",
  ghost: "👻",
  robot: "🤖",
  alien: "👽",
};

/**
 * Resolve a shortcode name to its emoji character. Tries the name as
 * given, then a lowercased variant. Returns null when the shortcode is
 * unknown.
 */
export function emojiForShortcode(name: string): string | null {
  if (!name) return null;
  return EMOJI[name] ?? EMOJI[name.toLowerCase()] ?? null;
}

/**
 * Build a single emoji text node.
 */
function emojiTextNode(emoji: string): DocumentNode {
  return { type: "text", text: emoji };
}

/**
 * Input rule: when the user finishes typing `:name:`, look the
 * shortcode up in `EMOJI` and, if found, replace the whole `:name:`
 * span with the emoji. If the shortcode is unknown the rule returns
 * false, leaving the typed text literal.
 */
const emojiRule: InputRule = {
  match: /:([a-z0-9_+-]+):$/i,
  handler: (editor, m) => {
    const name = m[1];
    if (!name) return false;
    const emoji = emojiForShortcode(name);
    if (!emoji) return false;
    const sel = editor.getSelection();
    if (!sel) return false;
    const path = sel.anchor.path;
    const caret = sel.anchor.offset;
    const start = caret - m[0].length;
    if (start < 0) return false;
    const doc = cloneDoc(editor.getJSON());
    const block = nodeAt(doc, path);
    if (!block) return false;
    block.content = replaceInlineRange(block.content ?? [], start, caret, [
      emojiTextNode(emoji),
    ]);
    const offset = start + emoji.length;
    editor.dispatch({
      doc,
      selection: { anchor: { path, offset }, head: { path, offset } },
      addToHistory: true,
    });
    return true;
  },
};

/** Argument shape for the object form of `insertEmoji`. */
export interface InsertEmojiOptions {
  /** Shortcode name (without colons) or a raw emoji character. */
  name: string;
}

/**
 * Resolve the argument passed to `insertEmoji` to an emoji string.
 *
 * Accepts either a known shortcode (resolved via the map) or a raw
 * emoji passed directly. To keep the two shapes unambiguous we first
 * try the map; if that misses, a short non-shortcode-looking string is
 * treated as the literal emoji to insert. Returns null when nothing
 * resolves.
 */
function resolveEmoji(arg: string | InsertEmojiOptions | undefined): string | null {
  if (arg == null) return null;
  const value = typeof arg === "string" ? arg : arg.name;
  if (typeof value !== "string" || value.length === 0) return null;
  // Prefer the shortcode map.
  const fromMap = emojiForShortcode(value);
  if (fromMap) return fromMap;
  // Otherwise treat a short literal (e.g. a raw emoji char) as the
  // emoji itself. A long string that isn't a shortcode is rejected so
  // a typo'd `:name:` doesn't silently insert prose.
  if (value.length <= 8 && !/^[a-z0-9_+-]+$/i.test(value)) return value;
  return null;
}

const commands: NonNullable<Extension["commands"]> = {
  /**
   * insertEmoji({ name }) or insertEmoji(name) — insert an emoji at the
   * caret. `name` may be a known shortcode (resolved via `EMOJI`) or a
   * raw emoji character. Returns false when the argument can't be
   * resolved to an emoji.
   */
  insertEmoji:
    (arg: string | InsertEmojiOptions) =>
    (editor: EditorInstance): boolean => {
      const emoji = resolveEmoji(arg);
      if (!emoji) return false;
      const sel = editor.getSelection();
      if (!sel) return false;
      const path = sel.anchor.path;
      const caret = sel.anchor.offset;
      const doc = cloneDoc(editor.getJSON());
      const block = nodeAt(doc, path);
      if (!block) return false;
      block.content = insertInlineAt(block.content ?? [], caret, [
        emojiTextNode(emoji),
      ]);
      const offset = caret + emoji.length;
      editor.dispatch({
        doc,
        selection: { anchor: { path, offset }, head: { path, offset } },
        addToHistory: true,
      });
      return true;
    },
};

export const EmojiExtension: Extension = {
  name: "emoji",
  inputRules: [emojiRule],
  commands,
};

export default EmojiExtension;
