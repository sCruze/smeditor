/**
 * @smeditor/react — public API.
 */

export { useEditor } from "./useEditor.js";
export type {
  UseEditorOptions,
  UseEditorResult,
} from "./useEditor.js";

export {
  Editor,
  EditorContent,
  EditorProvider,
  useEditorContext,
} from "./Editor.js";
export type {
  EditorProps,
  EditorContentProps,
  EditorProviderProps,
} from "./Editor.js";

export {
  Toolbar,
  ToolbarDivider,
  // Marks
  BoldButton,
  ItalicButton,
  UnderlineButton,
  StrikeButton,
  InlineCodeButton,
  SubscriptButton,
  SuperscriptButton,
  LinkButton,
  ClearFormattingButton,
  // Block types
  ParagraphButton,
  HeadingButton,
  BlockquoteButton,
  CodeBlockButton,
  HorizontalRuleButton,
  // Lists
  BulletListButton,
  OrderedListButton,
  TaskListButton,
  // Alignment & indent
  AlignLeftButton,
  AlignCenterButton,
  AlignRightButton,
  AlignJustifyButton,
  IndentButton,
  OutdentButton,
  // Dropdowns
  BlockTypeDropdown,
  HeadingsDropdown,
  ListsDropdown,
  AlignDropdown,
  // Color pickers
  TextColorButton,
  TextStrokeButton,
  BackgroundColorButton,
  HighlightButton,
  // More
  MoreMenu,
  // History
  UndoButton,
  RedoButton,
  // Read-only helper
  EditableToggle,
  // Image
  ImageButton,
  ImageToolbar,
  // Table
  TableButton,
  TableToolbar,
  // Fonts
  FontFamilyDropdown,
  FontSizeDropdown,
  LineHeightDropdown,
} from "./Toolbar.js";
export type {
  ToolbarProps,
  MoreMenuProps,
  EditableToggleProps,
  ImageButtonProps,
} from "./Toolbar.js";

export { Dropdown, DropdownItem, DropdownSeparator } from "./Dropdown.js";
export type { DropdownProps, DropdownItemProps } from "./Dropdown.js";

// Floating UI primitive + the menus built on it
export { Floating } from "./Floating.js";
export type { FloatingProps, FloatingPlacement } from "./Floating.js";

export { BubbleMenu } from "./BubbleMenu.js";
export type { BubbleMenuProps } from "./BubbleMenu.js";

export { SlashMenu, DEFAULT_SLASH_ITEMS } from "./SlashMenu.js";
export type { SlashMenuProps, SlashItem } from "./SlashMenu.js";

export { MentionMenu } from "./MentionMenu.js";
export type { MentionMenuProps, MentionItem } from "./MentionMenu.js";

export { TrackChangesPanel } from "./TrackChangesPanel.js";
export type { TrackChangesPanelProps } from "./TrackChangesPanel.js";

export { RemoteCursors } from "./RemoteCursors.js";
export type { RemoteCursorsProps, RemotePeer } from "./RemoteCursors.js";

export { ImageResizer } from "./ImageResizer.js";

export { TableColumnResizer } from "./TableColumnResizer.js";

export { TableRowResizer } from "./TableRowResizer.js";
export type { TableRowResizerProps } from "./TableRowResizer.js";

export { TableCellSelection } from "./TableCellSelection.js";

export { SourceView } from "./SourceView.js";
export type { SourceViewProps } from "./SourceView.js";

// Find & replace UI (drives the @smeditor/extension-find-replace commands).
export { SearchPanel } from "./SearchPanel.js";
export type { SearchPanelProps } from "./SearchPanel.js";

// Auto table of contents from the document's headings.
export { TableOfContents } from "./TableOfContents.js";
export type { TableOfContentsProps } from "./TableOfContents.js";

// Emoji + special-character picker (uses the insertEmoji command).
export { EmojiPicker } from "./EmojiPicker.js";
export type { EmojiPickerProps } from "./EmojiPicker.js";

// Drag-to-reorder blocks with a drop indicator.
export { DragHandle } from "./DragHandle.js";
export type { DragHandleProps } from "./DragHandle.js";

// Zero-dependency code highlighter for read-only code rendering.
export { highlightCode } from "./codeHighlight.js";

// Icons — small inline SVGs, exported so apps can reuse them in their
// own toolbars without depending on an icon library.
export * as icons from "./icons.js";

// Convenience re-exports — most React users never need to reach into core.
export type {
  EditorInstance,
  EditorOptions,
  EditorTheme,
  EditorSelection,
  DocumentJSON,
  DocumentNode,
  Extension,
  ExtensionBundle,
  Mark,
  NodeSpec,
  MarkSpec,
} from "@smeditor/core";
