/**
 * @smeditor/starter-kit
 *
 * The "batteries included" entry point — the MVP §20 toolset:
 * paragraphs, all six headings, bold/italic/underline/strike, link,
 * bullet/ordered/task lists, blockquote, code block, horizontal rule,
 * image, table, text alignment, hard breaks, clear-formatting, markdown
 * input shortcuts, an empty-state placeholder, and undo/redo.
 *
 * StarterKit is a bundle exposing `extensions: Extension[]`. Core's
 * `flattenExtensions` understands bundles, so it drops straight into
 * the `extensions` prop.
 */

import type { ExtensionBundle } from "@smeditor/core";

import { ParagraphExtension } from "@smeditor/extension-paragraph";
import { HeadingExtension } from "@smeditor/extension-heading";
import { BoldExtension } from "@smeditor/extension-bold";
import { ItalicExtension } from "@smeditor/extension-italic";
import { UnderlineExtension } from "@smeditor/extension-underline";
import { StrikeExtension } from "@smeditor/extension-strike";
import { LinkExtension } from "@smeditor/extension-link";
import { BlockquoteExtension } from "@smeditor/extension-blockquote";
import { CodeBlockExtension } from "@smeditor/extension-code-block";
import { HardBreakExtension } from "@smeditor/extension-hard-break";
import { ListItemExtension } from "@smeditor/extension-list-item";
import { BulletListExtension } from "@smeditor/extension-bullet-list";
import { OrderedListExtension } from "@smeditor/extension-ordered-list";
import { TaskListExtension } from "@smeditor/extension-task-list";
import { TaskItemExtension } from "@smeditor/extension-task-item";
import { TextAlignExtension } from "@smeditor/extension-text-align";
import { ClearFormattingExtension } from "@smeditor/extension-clear-formatting";
import { HorizontalRuleExtension } from "@smeditor/extension-horizontal-rule";
import { ImageExtension } from "@smeditor/extension-image";
import { TableExtension } from "@smeditor/extension-table";
import { MarkdownExtension } from "@smeditor/extension-markdown";
import { PlaceholderExtension } from "@smeditor/extension-placeholder";
import { HistoryExtension } from "@smeditor/extension-history";

export const StarterKit: ExtensionBundle = {
  name: "starter-kit",
  extensions: [
    // Block nodes
    ParagraphExtension,
    HeadingExtension,
    BlockquoteExtension,
    CodeBlockExtension,
    ListItemExtension,
    BulletListExtension,
    OrderedListExtension,
    TaskItemExtension,
    TaskListExtension,
    HardBreakExtension,
    HorizontalRuleExtension,
    ImageExtension,
    TableExtension,
    // Marks
    BoldExtension,
    ItalicExtension,
    UnderlineExtension,
    StrikeExtension,
    LinkExtension,
    // Behaviour / commands
    TextAlignExtension,
    ClearFormattingExtension,
    MarkdownExtension,
    PlaceholderExtension,
    HistoryExtension,
  ],
};

export {
  ParagraphExtension,
  HeadingExtension,
  BoldExtension,
  ItalicExtension,
  UnderlineExtension,
  StrikeExtension,
  LinkExtension,
  BlockquoteExtension,
  CodeBlockExtension,
  HardBreakExtension,
  ListItemExtension,
  BulletListExtension,
  OrderedListExtension,
  TaskListExtension,
  TaskItemExtension,
  TextAlignExtension,
  ClearFormattingExtension,
  HorizontalRuleExtension,
  ImageExtension,
  TableExtension,
  MarkdownExtension,
  PlaceholderExtension,
  HistoryExtension,
};

export default StarterKit;
