/**
 * @smeditor/full-kit
 *
 * The larger MVP-safe bundle. Includes everything in StarterKit plus
 * inline-formatting, color, text outline, sub/superscript, typography, indent
 * and word-count extensions.
 *
 * Architectural note: FullKit reuses StarterKit's extension list
 * directly — it doesn't duplicate paragraph/heading/bold/image/etc.
 * A fix to StarterKit automatically flows through to FullKit users.
 *
 * Horizontal rule, image and markdown shortcuts moved into StarterKit
 * in v0.0.4 (they're MVP-tier), so FullKit no longer lists them — it
 * gets them via `...StarterKit.extensions`.
 */

import type { ExtensionBundle } from "@smeditor/core";
import { StarterKit } from "@smeditor/starter-kit";

import { InlineCodeExtension } from "@smeditor/extension-inline-code";
import { SubscriptExtension } from "@smeditor/extension-subscript";
import { SuperscriptExtension } from "@smeditor/extension-superscript";
import { HighlightExtension } from "@smeditor/extension-highlight";
import { TextColorExtension } from "@smeditor/extension-text-color";
import { TextStrokeExtension } from "@smeditor/extension-text-stroke";
import { BackgroundColorExtension } from "@smeditor/extension-background-color";
import { IndentExtension } from "@smeditor/extension-indent";
import { TableExtension } from "@smeditor/extension-table";
import { FontFamilyExtension } from "@smeditor/extension-font-family";
import { FontSizeExtension } from "@smeditor/extension-font-size";
import { LineHeightExtension } from "@smeditor/extension-line-height";
import {
  WordCountExtension,
  countWords,
  countCharacters,
  getPlainText,
} from "@smeditor/extension-word-count";

export const FullKit: ExtensionBundle = {
  name: "full-kit",
  extensions: [
    ...StarterKit.extensions,
    InlineCodeExtension,
    SubscriptExtension,
    SuperscriptExtension,
    HighlightExtension,
    TextColorExtension,
    TextStrokeExtension,
    BackgroundColorExtension,
    IndentExtension,
    FontFamilyExtension,
    FontSizeExtension,
    LineHeightExtension,
    WordCountExtension,
  ],
};

// Re-export the FullKit bonuses so consumers can grab them individually
// without importing each package. Advanced/Pro backlog features such as
// comments, mentions and track changes stay opt-in via their own packages.
export {
  InlineCodeExtension,
  SubscriptExtension,
  SuperscriptExtension,
  HighlightExtension,
  TextColorExtension,
  TextStrokeExtension,
  BackgroundColorExtension,
  TableExtension,
  IndentExtension,
  FontFamilyExtension,
  FontSizeExtension,
  LineHeightExtension,
  WordCountExtension,
  // Word-count helpers — useful for status bars
  countWords,
  countCharacters,
  getPlainText,
};

// Re-export StarterKit for convenience.
export { StarterKit };

export default FullKit;
