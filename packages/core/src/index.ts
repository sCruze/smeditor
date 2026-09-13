/**
 * @smeditor/core — public API.
 *
 * This barrel re-exports the framework-agnostic surface of the editor.
 * Higher-level packages (`@smeditor/react`, extensions, …) import from
 * here. We are deliberate about what is re-exported: internal helpers
 * stay internal so we can evolve them without breaking consumers.
 */

export { createEditor } from "./editor.js";
export { compileSchema, flattenExtensions } from "./schema.js";
export { serializeToHTML, parseHTML, escapeHTML } from "./serializer.js";
export {
  sanitizeCSSColor,
  sanitizeCSSFontFamily,
  sanitizeCSSFontSize,
  sanitizeCSSLineHeight,
  sanitizeCSSTextStrokeWidth,
  sanitizeURL,
  sanitizeLinkTarget,
  hardenLinkAttrs,
} from "./css.js";
export { History } from "./history.js";
export { EventEmitter } from "./events.js";
export {
  cloneDoc,
  docsEqual,
  emptyDocument,
  hasMark,
  selectionHasMark,
  toggleMarkInDoc,
  setMarkAcrossSelection,
  unsetMarkAcrossSelection,
  clearMarksAcrossSelection,
  setBlockType,
  leafBlocksInSelection,
  getBlockText,
  stripBlockPrefix,
} from "./doc-utils.js";
export {
  visibleLength,
  inlineLength,
  blockVisibleText,
  splitInlineAt,
  insertInlineAt,
  deleteInlineRange,
  replaceInlineRange,
  applyMarkToInlineRange,
  setMarkOnInlineRange,
  removeMarkFromInlineRange,
  splitBlock,
} from "./transform.js";
export {
  isLeafBlock,
  isContainerBlock,
  nodeAt,
  parentAt,
  descendToLeafPath,
  mapNodeAt,
  removeNodeAt,
  resolveSelectionTarget,
  normalizeDeepPoint,
} from "./path.js";
export {
  selectionBlockRange,
  wrapBlocks,
  unwrapBlock,
  toggleWrap,
  selectionInsideWrapper,
  setBlockAttrs,
  getBlockAttr,
} from "./block-ops.js";

export type {
  // Document model
  DocumentNode,
  DocumentJSON,
  Mark,
  // Selection
  EditorSelection,
  SelectionPoint,
  // Schema
  NodeSpec,
  MarkSpec,
  NodeAttrSpec,
  DOMOutputSpec,
  ParseRule,
  CompiledSchema,
  // Extensions / commands
  Extension,
  ExtensionBundle,
  Command,
  CommandMap,
  KeyboardShortcuts,
  InputRule,
  // Editor
  EditorInstance,
  EditorOptions,
  EditorTheme,
  Transaction,
  // Events
  EditorEventName,
  EditorEventPayload,
} from "./types.js";

/** Library version — kept in sync with package.json by build tooling. */
export const VERSION = "0.0.12";
