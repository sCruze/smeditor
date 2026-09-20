/**
 * Toolbar primitives.
 *
 * The toolbar surface is a `<Toolbar>` wrapper plus a collection of
 * pre-built buttons and dropdowns. Apps that want a different layout
 * just compose the parts they need.
 *
 * Architectural rule: every button here references its command via
 * `editor.commands.X?.()` — the optional-chain pattern means a button
 * silently does nothing if its owning extension isn't loaded. So a
 * StarterKit-only app can render a FullKit-flavoured toolbar and the
 * Pro-only buttons just won't fire. No errors, no broken UI.
 */

import { useState } from "react";
import type { ReactNode, ButtonHTMLAttributes } from "react";
import type { EditorInstance, DocumentNode } from "@smeditor/core";
import { contrastTextColor, selectionInsideWrapper } from "@smeditor/core";

/**
 * The leaf block the caret actually sits in. With the deep selection
 * model the anchor path reaches into tables / lists / blockquotes, so
 * indexing `content[path[0]]` would read the container, not the
 * paragraph — and a toolbar dropdown would show the wrong active
 * state. This walks the whole path and returns the deepest block.
 */
function leafBlockUnderSelection(
  editor: EditorInstance,
): DocumentNode | null {
  const sel = editor.getSelection();
  if (!sel) return null;
  let node: DocumentNode = editor.getJSON();
  for (const idx of sel.anchor.path) {
    const child = node.content?.[idx];
    if (!child) break;
    node = child;
  }
  return node.type === "doc" ? null : node;
}
import { useEditorContext } from "./Editor.js";
import { Dropdown, DropdownItem, DropdownSeparator, useDropdownClose } from "./Dropdown.js";
import {
  IconUndo,
  IconRedo,
  IconBold,
  IconItalic,
  IconStrike,
  IconUnderline,
  IconInlineCode,
  IconSubscript,
  IconSuperscript,
  IconEraser,
  IconLink,
  IconHighlight,
  IconTextColor,
  IconBackgroundColor,
  IconTextStroke,
  IconUnderlineColor,
  IconBlockquote,
  IconCodeBlock,
  IconHorizontalRule,
  IconBulletList,
  IconOrderedList,
  IconTaskList,
  IconAlignLeft,
  IconAlignCenter,
  IconAlignRight,
  IconAlignJustify,
  IconIndent,
  IconOutdent,
  IconHeading,
  IconParagraph,
  IconMore,
  IconImage,
  IconTrash,
  IconTable,
} from "./icons.js";

export interface ToolbarProps {
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}

export function Toolbar({
  children,
  className,
  ariaLabel = "Editor toolbar",
}: ToolbarProps) {
  return (
    <div
      className={["smeditor-toolbar", className].filter(Boolean).join(" ")}
      role="toolbar"
      aria-label={ariaLabel}
      aria-orientation="horizontal"
    >
      {children}
    </div>
  );
}

/** Vertical divider between toolbar groups. */
export function ToolbarDivider() {
  return (
    <span
      className="smeditor-toolbar__divider"
      role="separator"
      aria-hidden="true"
    />
  );
}

// ============================================================================
// Generic command button
// ============================================================================

function hasCommand(editor: EditorInstance, name: string): boolean {
  return typeof editor.commands[name] === "function";
}

function hasCommands(editor: EditorInstance, names: string[]): boolean {
  return names.every((name) => hasCommand(editor, name));
}

function currentBlockIndent(editor: EditorInstance): number {
  return Number(leafBlockUnderSelection(editor)?.attrs?.indent ?? 0) || 0;
}

function currentLineHeight(editor: EditorInstance): string | null {
  const value = leafBlockUnderSelection(editor)?.attrs?.lineHeight;
  return typeof value === "string" && value ? value : null;
}

function currentTableCell(editor: EditorInstance): DocumentNode | null {
  const sel = editor.getSelection();
  if (!sel) return null;
  let node: DocumentNode = editor.getJSON();
  let cell: DocumentNode | null = null;
  for (const idx of sel.anchor.path) {
    const child = node.content?.[idx];
    if (!child) break;
    if (child.type === "table_cell") cell = child;
    node = child;
  }
  return cell;
}

function currentCellBackground(editor: EditorInstance): string | null {
  const value = currentTableCell(editor)?.attrs?.backgroundColor;
  return typeof value === "string" && value ? value : null;
}

function currentCellAlign(editor: EditorInstance): string | null {
  const value = currentTableCell(editor)?.attrs?.textAlign;
  return typeof value === "string" && value ? value : null;
}

interface CommandButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  command: (editor: EditorInstance) => boolean;
  commandName?: string;
  commandNames?: string[];
  isActive?: (editor: EditorInstance) => boolean;
  isDisabled?: (editor: EditorInstance) => boolean;
  label: string;
  children?: ReactNode;
}

function CommandButton({
  command,
  commandName,
  commandNames,
  isActive,
  isDisabled,
  label,
  children,
  className,
  disabled: disabledProp,
  ...rest
}: CommandButtonProps) {
  const editor = useEditorContext();
  if (!editor) return null;
  const requiredCommands = commandNames ?? (commandName ? [commandName] : []);
  const available = requiredCommands.every((name) => hasCommand(editor, name));
  if (!available) return null;
  const active = isActive ? isActive(editor) : false;
  const disabled =
    Boolean(disabledProp) ||
    !editor.isEditable() ||
    Boolean(isDisabled?.(editor));
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      aria-disabled={disabled}
      disabled={disabled}
      title={label}
      data-active={active ? "true" : "false"}
      className={[
        "smeditor-button",
        active ? "is-active" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        if (!disabled) command(editor);
      }}
      {...rest}
    >
      {children ?? label}
    </button>
  );
}

// ============================================================================
// Marks
// ============================================================================

export function BoldButton(p: { children?: ReactNode }) {
  return (
    <CommandButton
      label="Bold"
      aria-keyshortcuts="Control+B Meta+B"
      commandName="toggleBold"
      command={(e) => e.commands.toggleBold?.() ?? false}
      isActive={(e) => e.isActive("bold")}
    >
      {p.children ?? <IconBold />}
    </CommandButton>
  );
}

export function ItalicButton(p: { children?: ReactNode }) {
  return (
    <CommandButton
      label="Italic"
      aria-keyshortcuts="Control+I Meta+I"
      commandName="toggleItalic"
      command={(e) => e.commands.toggleItalic?.() ?? false}
      isActive={(e) => e.isActive("italic")}
    >
      {p.children ?? <IconItalic />}
    </CommandButton>
  );
}

export function UnderlineButton(p: { children?: ReactNode }) {
  return (
    <CommandButton
      label="Underline"
      aria-keyshortcuts="Control+U Meta+U"
      commandName="toggleUnderline"
      command={(e) => e.commands.toggleUnderline?.() ?? false}
      isActive={(e) => e.isActive("underline")}
    >
      {p.children ?? <IconUnderline />}
    </CommandButton>
  );
}

export function StrikeButton(p: { children?: ReactNode }) {
  return (
    <CommandButton
      label="Strike-through"
      commandName="toggleStrike"
      command={(e) => e.commands.toggleStrike?.() ?? false}
      isActive={(e) => e.isActive("strike")}
    >
      {p.children ?? <IconStrike />}
    </CommandButton>
  );
}

/** Inline `<code>` toggle — provided by `@smeditor/extension-inline-code`. */
export function InlineCodeButton(p: { children?: ReactNode }) {
  return (
    <CommandButton
      label="Inline code"
      aria-keyshortcuts="Control+E Meta+E"
      commandName="toggleCode"
      command={(e) => e.commands.toggleCode?.() ?? false}
      isActive={(e) => e.isActive("code")}
    >
      {p.children ?? <IconInlineCode />}
    </CommandButton>
  );
}

export function SubscriptButton(p: { children?: ReactNode }) {
  return (
    <CommandButton
      label="Subscript"
      commandName="toggleSubscript"
      command={(e) => e.commands.toggleSubscript?.() ?? false}
      isActive={(e) => e.isActive("subscript")}
    >
      {p.children ?? <IconSubscript />}
    </CommandButton>
  );
}

export function SuperscriptButton(p: { children?: ReactNode }) {
  return (
    <CommandButton
      label="Superscript"
      commandName="toggleSuperscript"
      command={(e) => e.commands.toggleSuperscript?.() ?? false}
      isActive={(e) => e.isActive("superscript")}
    >
      {p.children ?? <IconSuperscript />}
    </CommandButton>
  );
}

export function LinkButton(p: { children?: ReactNode }) {
  return (
    <CommandButton
      label="Link"
      commandNames={["setLink", "unsetLink"]}
      command={(e) => {
        if (typeof window === "undefined") return false;
        if (e.isActive("link")) return e.commands.unsetLink?.() ?? false;
        const href = window.prompt("Link URL", "https://");
        if (!href) return false;
        return e.commands.setLink?.({ href }) ?? false;
      }}
      isActive={(e) => e.isActive("link")}
    >
      {p.children ?? <IconLink />}
    </CommandButton>
  );
}

export function ClearFormattingButton(p: { children?: ReactNode }) {
  return (
    <CommandButton
      label="Clear formatting"
      commandName="clearFormatting"
      command={(e) => e.commands.clearFormatting?.() ?? false}
    >
      {p.children ?? <IconEraser />}
    </CommandButton>
  );
}

// ============================================================================
// Block types
// ============================================================================

export function ParagraphButton(p: { children?: ReactNode }) {
  return (
    <CommandButton
      label="Paragraph"
      commandName="setParagraph"
      command={(e) => e.commands.setParagraph?.() ?? false}
      isActive={(e) => e.isActive("paragraph")}
    >
      {p.children ?? <IconParagraph />}
    </CommandButton>
  );
}

export function HeadingButton(p: {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children?: ReactNode;
}) {
  return (
    <CommandButton
      label={`Heading ${p.level}`}
      commandName="setHeading"
      command={(e) => e.commands.setHeading?.({ level: p.level }) ?? false}
      isActive={(e) => e.isActive("heading", { level: p.level })}
    >
      {p.children ?? <IconHeading level={p.level} />}
    </CommandButton>
  );
}

export function BlockquoteButton(p: { children?: ReactNode }) {
  return (
    <CommandButton
      label="Blockquote"
      commandName="toggleBlockquote"
      command={(e) => e.commands.toggleBlockquote?.() ?? false}
      isActive={(e) =>
        selectionInsideWrapper(e.getJSON(), e.getSelection(), "blockquote")
      }
    >
      {p.children ?? <IconBlockquote />}
    </CommandButton>
  );
}

export function CodeBlockButton(p: { children?: ReactNode }) {
  return (
    <CommandButton
      label="Code block"
      commandName="setCodeBlock"
      command={(e) => e.commands.setCodeBlock?.() ?? false}
      isActive={(e) => e.isActive("code_block")}
    >
      {p.children ?? <IconCodeBlock />}
    </CommandButton>
  );
}

export function HorizontalRuleButton(p: { children?: ReactNode }) {
  return (
    <CommandButton
      label="Horizontal rule"
      commandName="insertHorizontalRule"
      command={(e) => e.commands.insertHorizontalRule?.() ?? false}
    >
      {p.children ?? <IconHorizontalRule />}
    </CommandButton>
  );
}

// ============================================================================
// Lists
// ============================================================================

export function BulletListButton(p: { children?: ReactNode }) {
  return (
    <CommandButton
      label="Bullet list"
      commandName="toggleBulletList"
      command={(e) => e.commands.toggleBulletList?.() ?? false}
      isActive={(e) =>
        selectionInsideWrapper(e.getJSON(), e.getSelection(), "bullet_list")
      }
    >
      {p.children ?? <IconBulletList />}
    </CommandButton>
  );
}

export function OrderedListButton(p: { children?: ReactNode }) {
  return (
    <CommandButton
      label="Ordered list"
      commandName="toggleOrderedList"
      command={(e) => e.commands.toggleOrderedList?.() ?? false}
      isActive={(e) =>
        selectionInsideWrapper(e.getJSON(), e.getSelection(), "ordered_list")
      }
    >
      {p.children ?? <IconOrderedList />}
    </CommandButton>
  );
}

export function TaskListButton(p: { children?: ReactNode }) {
  return (
    <CommandButton
      label="Task list"
      commandName="toggleTaskList"
      command={(e) => e.commands.toggleTaskList?.() ?? false}
      isActive={(e) =>
        selectionInsideWrapper(e.getJSON(), e.getSelection(), "task_list")
      }
    >
      {p.children ?? <IconTaskList />}
    </CommandButton>
  );
}

// ============================================================================
// Alignment & indent
// ============================================================================

function alignActive(e: EditorInstance, align: string): boolean {
  const block = leafBlockUnderSelection(e);
  if (!block) return false;
  return ((block.attrs?.textAlign ?? "left") as string) === align;
}

export function AlignLeftButton() {
  return (
    <CommandButton
      label="Align left"
      commandName="setTextAlign"
      command={(e) => e.commands.setTextAlign?.({ align: "left" }) ?? false}
      isActive={(e) => alignActive(e, "left")}
    >
      <IconAlignLeft />
    </CommandButton>
  );
}
export function AlignCenterButton() {
  return (
    <CommandButton
      label="Align center"
      commandName="setTextAlign"
      command={(e) => e.commands.setTextAlign?.({ align: "center" }) ?? false}
      isActive={(e) => alignActive(e, "center")}
    >
      <IconAlignCenter />
    </CommandButton>
  );
}
export function AlignRightButton() {
  return (
    <CommandButton
      label="Align right"
      commandName="setTextAlign"
      command={(e) => e.commands.setTextAlign?.({ align: "right" }) ?? false}
      isActive={(e) => alignActive(e, "right")}
    >
      <IconAlignRight />
    </CommandButton>
  );
}
export function AlignJustifyButton() {
  return (
    <CommandButton
      label="Justify"
      commandName="setTextAlign"
      command={(e) => e.commands.setTextAlign?.({ align: "justify" }) ?? false}
      isActive={(e) => alignActive(e, "justify")}
    >
      <IconAlignJustify />
    </CommandButton>
  );
}

export function IndentButton() {
  return (
    <CommandButton
      label="Increase indent"
      commandName="indent"
      command={(e) => e.commands.indent?.() ?? false}
      isDisabled={(e) => currentBlockIndent(e) >= 8}
    >
      <IconIndent />
    </CommandButton>
  );
}
export function OutdentButton() {
  return (
    <CommandButton
      label="Decrease indent"
      commandName="outdent"
      command={(e) => e.commands.outdent?.() ?? false}
      isDisabled={(e) => currentBlockIndent(e) <= 0}
    >
      <IconOutdent />
    </CommandButton>
  );
}

// ============================================================================
// Dropdowns
// ============================================================================

/**
 * Block-type dropdown — Paragraph / H1-H6 / Quote / Code block.
 * Replaces the old "Headings dropdown" and covers the full §3 ТЗ
 * requirement for a block-type selector.
 */
export function BlockTypeDropdown() {
  const editor = useEditorContext();
  if (!editor) return null;

  const canSetParagraph = hasCommand(editor, "setParagraph");
  const canSetHeading = hasCommand(editor, "setHeading");
  const canToggleBlockquote = hasCommand(editor, "toggleBlockquote");
  const canSetCodeBlock = hasCommand(editor, "setCodeBlock");
  if (
    !canSetParagraph &&
    !canSetHeading &&
    !canToggleBlockquote &&
    !canSetCodeBlock
  ) {
    return null;
  }

  const summary = (() => {
    // Container types win: a paragraph inside a blockquote should
    // read as "❝", not "P". Check container/specialty types first,
    // then headings, then fall back to paragraph.
    if (selectionInsideWrapper(editor.getJSON(), editor.getSelection(), "blockquote")) {
      return "❝";
    }
    if (editor.isActive("code_block")) return "</>";
    for (const level of [1, 2, 3, 4, 5, 6]) {
      if (editor.isActive("heading", { level })) return `H${level}`;
    }
    if (editor.isActive("paragraph")) return "P";
    return "P";
  })();

  const inQuote = selectionInsideWrapper(
    editor.getJSON(),
    editor.getSelection(),
    "blockquote",
  );

  return (
    <Dropdown
      ariaLabel="Block type"
      label={<IconHeading level={2} />}
      summary={summary}
      disabled={!editor.isEditable()}
    >
      {canSetParagraph && (
        <DropdownItem
          icon={<IconParagraph />}
          active={editor.isActive("paragraph")}
          onSelect={() => editor.commands.setParagraph?.()}
        >
          Paragraph
        </DropdownItem>
      )}
      {canSetParagraph && canSetHeading && <DropdownSeparator />}
      {canSetHeading &&
        ([1, 2, 3, 4, 5, 6] as const).map((level) => (
          <DropdownItem
            key={level}
            icon={<IconHeading level={level} />}
            active={editor.isActive("heading", { level })}
            shortcut={`⌘⌥${level}`}
            onSelect={() => editor.commands.setHeading?.({ level })}
          >
            {`Heading ${level}`}
          </DropdownItem>
        ))}
      {(canSetHeading || canSetParagraph) &&
        (canToggleBlockquote || canSetCodeBlock) && <DropdownSeparator />}
      {canToggleBlockquote && (
        <DropdownItem
          icon={<IconBlockquote />}
          active={inQuote}
          onSelect={() => editor.commands.toggleBlockquote?.()}
        >
          Quote
        </DropdownItem>
      )}
      {canSetCodeBlock && (
        <DropdownItem
          icon={<IconCodeBlock />}
          active={editor.isActive("code_block")}
          onSelect={() => editor.commands.setCodeBlock?.()}
        >
          Code block
        </DropdownItem>
      )}
    </Dropdown>
  );
}

/** Original Headings dropdown kept for backwards compat — alias of new BlockTypeDropdown. */
export const HeadingsDropdown = BlockTypeDropdown;

export function ListsDropdown() {
  const editor = useEditorContext();
  if (!editor) return null;

  const canToggleBullet = hasCommand(editor, "toggleBulletList");
  const canToggleOrdered = hasCommand(editor, "toggleOrderedList");
  const canToggleTask = hasCommand(editor, "toggleTaskList");
  if (!canToggleBullet && !canToggleOrdered && !canToggleTask) return null;

  const inBullet = selectionInsideWrapper(
    editor.getJSON(),
    editor.getSelection(),
    "bullet_list",
  );
  const inOrdered = selectionInsideWrapper(
    editor.getJSON(),
    editor.getSelection(),
    "ordered_list",
  );
  const inTask = selectionInsideWrapper(
    editor.getJSON(),
    editor.getSelection(),
    "task_list",
  );

  return (
    <Dropdown
      ariaLabel="Lists"
      label={<IconBulletList />}
      active={inBullet || inOrdered || inTask}
      disabled={!editor.isEditable()}
    >
      {canToggleBullet && (
        <DropdownItem
          icon={<IconBulletList />}
          active={inBullet}
          onSelect={() => editor.commands.toggleBulletList?.()}
          shortcut="⌘⇧8"
        >
          Bullet List
        </DropdownItem>
      )}
      {canToggleOrdered && (
        <DropdownItem
          icon={<IconOrderedList />}
          active={inOrdered}
          onSelect={() => editor.commands.toggleOrderedList?.()}
          shortcut="⌘⇧7"
        >
          Ordered List
        </DropdownItem>
      )}
      {canToggleTask && (
        <DropdownItem
          icon={<IconTaskList />}
          active={inTask}
          onSelect={() => editor.commands.toggleTaskList?.()}
          shortcut="⌘⇧9"
        >
          Task List
        </DropdownItem>
      )}
    </Dropdown>
  );
}

export function AlignDropdown() {
  const editor = useEditorContext();
  if (!editor) return null;

  const canSetTextAlign = hasCommand(editor, "setTextAlign");
  const canIndent = hasCommand(editor, "indent");
  const canOutdent = hasCommand(editor, "outdent");
  if (!canSetTextAlign && !canIndent && !canOutdent) return null;

  const current = (() => {
    const block = leafBlockUnderSelection(editor);
    return (block?.attrs?.textAlign ?? "left") as string;
  })();
  const iconFor = (a: string) =>
    a === "center" ? <IconAlignCenter /> :
    a === "right" ? <IconAlignRight /> :
    a === "justify" ? <IconAlignJustify /> :
    <IconAlignLeft />;

  const indent = currentBlockIndent(editor);

  return (
    <Dropdown
      ariaLabel="Text alignment"
      label={iconFor(current)}
      active={current !== "left" || indent > 0}
      disabled={!editor.isEditable()}
    >
      {canSetTextAlign && (
        <>
          <DropdownItem
            icon={<IconAlignLeft />}
            active={current === "left"}
            onSelect={() => editor.commands.setTextAlign?.({ align: "left" })}
          >
            Left
          </DropdownItem>
          <DropdownItem
            icon={<IconAlignCenter />}
            active={current === "center"}
            onSelect={() => editor.commands.setTextAlign?.({ align: "center" })}
          >
            Center
          </DropdownItem>
          <DropdownItem
            icon={<IconAlignRight />}
            active={current === "right"}
            onSelect={() => editor.commands.setTextAlign?.({ align: "right" })}
          >
            Right
          </DropdownItem>
          <DropdownItem
            icon={<IconAlignJustify />}
            active={current === "justify"}
            onSelect={() => editor.commands.setTextAlign?.({ align: "justify" })}
          >
            Justify
          </DropdownItem>
        </>
      )}
      {canSetTextAlign && (canIndent || canOutdent) && <DropdownSeparator />}
      {canIndent && (
        <DropdownItem
          icon={<IconIndent />}
          disabled={indent >= 8}
          onSelect={() => editor.commands.indent?.()}
        >
          Increase indent
        </DropdownItem>
      )}
      {canOutdent && (
        <DropdownItem
          icon={<IconOutdent />}
          disabled={indent <= 0}
          onSelect={() => editor.commands.outdent?.()}
        >
          Decrease indent
        </DropdownItem>
      )}
    </Dropdown>
  );
}

// ============================================================================
// Color picker dropdowns
// ============================================================================

const PALETTE = [
  "#1a1a1f", "#6b7280", "#ef4444", "#f97316", "#eab308",
  "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
  "#ffffff", "#d1d5db", "#fecaca", "#fed7aa", "#fef08a",
  "#bbf7d0", "#a5f3fc", "#bfdbfe", "#ddd6fe", "#fbcfe8",
];

interface ColorPickerProps {
  ariaLabel: string;
  label: ReactNode;
  active?: boolean;
  disabled?: boolean;
  /** Colour applied to the current selection — shown on the trigger and in the palette. */
  current?: string | null;
  onPick: (color: string) => void;
  onClear: () => void;
  /** Extra controls rendered between the palette and the remove button. */
  extra?: ReactNode;
}

function sameColor(a: string | null | undefined, b: string): boolean {
  return typeof a === "string" && a.trim().toLowerCase() === b.toLowerCase();
}

function markColor(editor: EditorInstance, mark: string): string | null {
  const color = editor.getMarkAttributes(mark)?.color;
  return typeof color === "string" && color ? color : null;
}

function ColorPanel({
  ariaLabel,
  active,
  disabled,
  current,
  onPick,
  onClear,
  extra,
}: Omit<ColorPickerProps, "label">) {
  const close = useDropdownClose();
  return (
    <div className="smeditor-color-panel" role="group" aria-label={ariaLabel}>
      <div className="smeditor-color-panel__title">{ariaLabel}</div>
      <div className="smeditor-color-grid">
        {PALETTE.map((color) => {
          const selected = sameColor(current, color);
          return (
            <button
              key={color}
              type="button"
              className={["smeditor-color-grid__swatch", selected ? "is-active" : ""].filter(Boolean).join(" ")}
              style={{ background: color }}
              aria-label={`${ariaLabel}: ${color}`}
              aria-pressed={selected}
              title={color}
              disabled={disabled}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onPick(color);
                close();
              }}
            />
          );
        })}
      </div>
      {extra}
      <button
        type="button"
        className="smeditor-color-panel__clear"
        disabled={disabled || !active}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          onClear();
          close();
        }}
      >
        Remove {ariaLabel.toLowerCase()}
      </button>
    </div>
  );
}

/**
 * Colour dropdown. The trigger shows a bar in the colour applied to the
 * selection, the palette marks it, and a labelled button removes it.
 */
function ColorPicker({ label, ...panel }: ColorPickerProps) {
  const { ariaLabel, active, disabled, current } = panel;
  return (
    <Dropdown
      ariaLabel={ariaLabel}
      label={
        <span className="smeditor-color-trigger" title={current ? `${ariaLabel}: ${current}` : ariaLabel}>
          {label}
          <span
            className="smeditor-color-trigger__bar"
            data-empty={current ? "false" : "true"}
            style={current ? { backgroundColor: current } : undefined}
          />
        </span>
      }
      active={active}
      disabled={disabled}
      className="smeditor-dropdown--color"
    >
      <ColorPanel {...panel} />
    </Dropdown>
  );
}

/** Text colour options on a fill; null = automatic contrast. */
const FILL_TEXT: { label: string; value: string | null }[] = [
  { label: "Auto", value: null },
  { label: "White", value: "#ffffff" },
  { label: "Dark", value: "#1a1a1f" },
];

/**
 * The text colour chosen for a fill: null when it is the automatic
 * contrast colour for the fill, otherwise the explicit colour.
 */
function fillTextChoice(attrs: Record<string, unknown> | null): string | null {
  const fill = typeof attrs?.color === "string" ? attrs.color : null;
  const text = typeof attrs?.textColor === "string" ? attrs.textColor : null;
  return fill && text && !sameColor(text, contrastTextColor(fill)) ? text : null;
}

function FillTextChips({
  current,
  caption,
  apply,
}: {
  current: Record<string, unknown> | null;
  caption: string;
  apply: (color: string, textColor: string | null) => void;
}) {
  const close = useDropdownClose();
  const choice = fillTextChoice(current);
  return (
    <>
      <div className="smeditor-color-panel__title">{caption}</div>
      <div className="smeditor-color-panel__widths">
        {FILL_TEXT.map((option) => {
          const selected = Boolean(current) && choice === option.value;
          return (
            <button
              key={option.label}
              type="button"
              className={["smeditor-color-panel__chip", selected ? "is-active" : ""].filter(Boolean).join(" ")}
              style={option.value ? ({ "--sme-chip-swatch": option.value } as Record<string, string>) : undefined}
              aria-pressed={selected}
              aria-label={`${caption}: ${option.label}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const color = typeof current?.color === "string" ? current.color : PALETTE[7];
                apply(color, option.value);
                close();
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </>
  );
}

export function TextColorButton() {
  const editor = useEditorContext();
  if (!editor || !hasCommands(editor, ["setTextColor", "unsetTextColor"])) {
    return null;
  }
  return (
    <ColorPicker
      ariaLabel="Text color"
      label={<IconTextColor />}
      active={editor.isActive("text_color")}
      current={markColor(editor, "text_color")}
      disabled={!editor.isEditable()}
      onPick={(color) => editor.commands.setTextColor?.({ color })}
      onClear={() => editor.commands.unsetTextColor?.()}
    />
  );
}

export function TextStrokeButton() {
  const editor = useEditorContext();
  if (!editor || !hasCommands(editor, ["setTextStroke", "unsetTextStroke"])) {
    return null;
  }
  return (
    <ColorPicker
      ariaLabel="Text stroke"
      label={<IconTextStroke />}
      active={editor.isActive("text_stroke")}
      current={markColor(editor, "text_stroke")}
      disabled={!editor.isEditable()}
      onPick={(color) => editor.commands.setTextStroke?.({ color, width: 1 })}
      onClear={() => editor.commands.unsetTextStroke?.()}
    />
  );
}

/**
 * Fill — paints the area behind the selected text; the text switches to
 * a readable colour on it (automatic, or White / Dark from the panel).
 */
export function BackgroundColorButton() {
  const editor = useEditorContext();
  if (
    !editor ||
    !hasCommands(editor, ["setBackgroundColor", "unsetBackgroundColor"])
  ) {
    return null;
  }
  const attrs = editor.getMarkAttributes("background_color");
  return (
    <ColorPicker
      ariaLabel="Fill"
      label={<IconBackgroundColor />}
      active={editor.isActive("background_color")}
      current={markColor(editor, "background_color")}
      disabled={!editor.isEditable()}
      onPick={(color) => editor.commands.setBackgroundColor?.({ color, textColor: fillTextChoice(attrs) })}
      onClear={() => editor.commands.unsetBackgroundColor?.()}
      extra={
        <FillTextChips
          current={attrs}
          caption="Text on fill"
          apply={(color, textColor) => editor.commands.setBackgroundColor?.({ color, textColor })}
        />
      }
    />
  );
}

/** Underline colour — underlines the selection in the picked colour. */
export function UnderlineColorButton() {
  const editor = useEditorContext();
  if (!editor || !hasCommands(editor, ["setUnderlineColor", "unsetUnderlineColor"])) {
    return null;
  }
  const color = markColor(editor, "underline");
  return (
    <ColorPicker
      ariaLabel="Underline color"
      label={<IconUnderlineColor />}
      active={Boolean(color)}
      current={color}
      disabled={!editor.isEditable()}
      onPick={(value) => editor.commands.setUnderlineColor?.({ color: value })}
      onClear={() => editor.commands.unsetUnderlineColor?.()}
    />
  );
}

export function HighlightButton() {
  const editor = useEditorContext();
  if (!editor || !hasCommands(editor, ["setHighlight", "unsetHighlight"])) {
    return null;
  }
  const attrs = editor.getMarkAttributes("highlight");
  return (
    <ColorPicker
      ariaLabel="Highlight"
      label={<IconHighlight />}
      active={editor.isActive("highlight")}
      current={markColor(editor, "highlight")}
      disabled={!editor.isEditable()}
      onPick={(color) => editor.commands.setHighlight?.({ color, textColor: fillTextChoice(attrs) })}
      onClear={() => editor.commands.unsetHighlight?.()}
      extra={
        <FillTextChips
          current={attrs}
          caption="Text on highlight"
          apply={(color, textColor) => editor.commands.setHighlight?.({ color, textColor })}
        />
      }
    />
  );
}

// ============================================================================
// "More" menu — §18 catch-all for less-used items
// ============================================================================

export interface MoreMenuProps {
  /** Render extra items inside the More dropdown. Each receives the editor. */
  children?: ReactNode;
}

export function MoreMenu({ children }: MoreMenuProps) {
  const editor = useEditorContext();
  if (!editor) return null;

  const canInsertHorizontalRule = hasCommand(editor, "insertHorizontalRule");
  const canToggleCode = hasCommand(editor, "toggleCode");
  const canToggleSubscript = hasCommand(editor, "toggleSubscript");
  const canToggleSuperscript = hasCommand(editor, "toggleSuperscript");
  const canIndent = hasCommand(editor, "indent");
  const canOutdent = hasCommand(editor, "outdent");
  const hasBuiltInItems =
    canInsertHorizontalRule ||
    canToggleCode ||
    canToggleSubscript ||
    canToggleSuperscript ||
    canIndent ||
    canOutdent;
  if (!hasBuiltInItems && !children) return null;

  const indent = currentBlockIndent(editor);

  return (
    <Dropdown
      ariaLabel="More tools"
      label={<IconMore />}
      align="right"
      disabled={!editor.isEditable()}
    >
      {canInsertHorizontalRule && (
        <DropdownItem
          icon={<IconHorizontalRule />}
          onSelect={() => editor.commands.insertHorizontalRule?.()}
        >
          Horizontal rule
        </DropdownItem>
      )}
      {canToggleCode && (
        <DropdownItem
          icon={<IconInlineCode />}
          active={editor.isActive("code")}
          onSelect={() => editor.commands.toggleCode?.()}
          shortcut="⌘E"
        >
          Inline code
        </DropdownItem>
      )}
      {(canInsertHorizontalRule || canToggleCode) &&
        (canToggleSubscript || canToggleSuperscript || canIndent || canOutdent) && (
          <DropdownSeparator />
        )}
      {canToggleSubscript && (
        <DropdownItem
          icon={<IconSubscript />}
          active={editor.isActive("subscript")}
          onSelect={() => editor.commands.toggleSubscript?.()}
          shortcut="⌘,"
        >
          Subscript
        </DropdownItem>
      )}
      {canToggleSuperscript && (
        <DropdownItem
          icon={<IconSuperscript />}
          active={editor.isActive("superscript")}
          onSelect={() => editor.commands.toggleSuperscript?.()}
          shortcut="⌘."
        >
          Superscript
        </DropdownItem>
      )}
      {(canToggleSubscript || canToggleSuperscript) &&
        (canIndent || canOutdent) && <DropdownSeparator />}
      {canIndent && (
        <DropdownItem
          icon={<IconIndent />}
          disabled={indent >= 8}
          onSelect={() => editor.commands.indent?.()}
          shortcut="⇥"
        >
          Increase indent
        </DropdownItem>
      )}
      {canOutdent && (
        <DropdownItem
          icon={<IconOutdent />}
          disabled={indent <= 0}
          onSelect={() => editor.commands.outdent?.()}
          shortcut="⇧⇥"
        >
          Decrease indent
        </DropdownItem>
      )}
      {children}
    </Dropdown>
  );
}

// ============================================================================
// History
// ============================================================================

export function UndoButton(p: { children?: ReactNode }) {
  return (
    <CommandButton
      label="Undo"
      aria-keyshortcuts="Control+Z Meta+Z"
      commandName="undo"
      command={(e) => e.commands.undo?.() ?? false}
      isDisabled={(e) => !e.canUndo()}
    >
      {p.children ?? <IconUndo />}
    </CommandButton>
  );
}

export function RedoButton(p: { children?: ReactNode }) {
  return (
    <CommandButton
      label="Redo"
      aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z"
      commandName="redo"
      command={(e) => e.commands.redo?.() ?? false}
      isDisabled={(e) => !e.canRedo()}
    >
      {p.children ?? <IconRedo />}
    </CommandButton>
  );
}

// ============================================================================
// Read-only toggle helper (no command; controlled by app state)
// ============================================================================

export interface EditableToggleProps {
  editable: boolean;
  onChange: (editable: boolean) => void;
  labels?: { edit: string; view: string };
}

/**
 * A toggle that flips a controlled `editable` flag. Use alongside
 * `<EditorContent editable={…} />` to give users a read-only preview.
 */
export function EditableToggle({
  editable,
  onChange,
  labels = { edit: "Edit", view: "View" },
}: EditableToggleProps) {
  return (
    <button
      type="button"
      className="smeditor-button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onChange(!editable)}
      aria-pressed={!editable}
      aria-label={
        editable
          ? "Switch editor to read-only mode"
          : "Switch editor to edit mode"
      }
      title={editable ? labels.view : labels.edit}
    >
      {editable ? labels.view : labels.edit}
    </button>
  );
}

// ============================================================================
// Image — insert (§9) + contextual toolbar (§19)
// ============================================================================

export interface ImageButtonProps {
  /**
   * Optional upload handler. When provided, the dropdown shows an
   * "Upload image" option that opens a file picker; the returned URL
   * is passed to `insertImage`. If omitted, a configured
   * `ImageExtension.configure({ upload })` handler is used when present.
   */
  onUpload?: (file: File) => Promise<string>;
  children?: ReactNode;
}

/**
 * Image insert button. A small dropdown with two ways in:
 *  - "From URL" — prompts for a URL
 *  - "Upload"   — opens a file picker when `onUpload` or an extension
 *                 upload command is available
 *
 * The actual upload is the host app's responsibility — SMEditor
 * doesn't ship a storage backend. The handler just needs to resolve
 * to a URL string or image attrs.
 */
export function ImageButton({ onUpload, children }: ImageButtonProps) {
  const editor = useEditorContext();
  if (!editor || !hasCommand(editor, "insertImage")) return null;
  const hasConfiguredUpload = hasCommand(editor, "uploadImage");

  const insertFromUrl = () => {
    if (typeof window === "undefined") return;
    const src = window.prompt("Image URL", "https://");
    if (!src) return;
    const alt = window.prompt("Alt text (optional)", "") ?? "";
    editor.commands.insertImage?.({ src, alt: alt || undefined });
  };

  const insertFromFile = () => {
    if (
      typeof document === "undefined" ||
      (!onUpload && !hasConfiguredUpload)
    ) {
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (hasConfiguredUpload && !onUpload) {
        editor.commands.uploadImage?.(file);
        return;
      }
      try {
        const url = await onUpload?.(file);
        if (url) editor.commands.insertImage?.({ src: url, alt: file.name });
      } catch (err) {
        // Upload failures are the app's concern — surface minimally.
        console.error("SMEditor image upload failed:", err);
      }
    };
    input.click();
  };

  return (
    <Dropdown
      ariaLabel="Insert image"
      label={children ?? <IconImage />}
      disabled={!editor.isEditable()}
    >
      <DropdownItem icon={<IconLink />} onSelect={insertFromUrl}>
        From URL…
      </DropdownItem>
      {(onUpload || hasConfiguredUpload) && (
        <DropdownItem icon={<IconImage />} onSelect={insertFromFile}>
          Upload image…
        </DropdownItem>
      )}
    </Dropdown>
  );
}

/**
 * Contextual image toolbar — render this only when the caret is in an
 * image block (use `editor.isActive("image")`). Covers the §19 image
 * context menu: align left/center/right, edit alt text, delete.
 *
 * Typically placed in a floating bar, but it works inline too — the
 * host decides placement.
 */
export function ImageToolbar() {
  const editor = useEditorContext();
  if (!editor || !editor.isActive("image")) return null;

  const currentAlign = (() => {
    const sel = editor.getSelection();
    const block = sel
      ? editor.getJSON().content[sel.anchor.path[0] ?? 0]
      : null;
    // An image with no align attr renders left (the theme only adds auto
    // margins for [data-align] variants), so default to "left" — matching
    // the rendered state instead of falsely showing "center" active.
    return (block?.attrs?.align ?? "left") as string;
  })();

  const editAlt = () => {
    if (typeof window === "undefined") return;
    const sel = editor.getSelection();
    const block = sel
      ? editor.getJSON().content[sel.anchor.path[0] ?? 0]
      : null;
    const current = (block?.attrs?.alt as string) ?? "";
    const next = window.prompt("Alt text", current);
    if (next !== null) editor.commands.updateImageAttrs?.({ alt: next });
  };

  const editCaption = () => {
    if (typeof window === "undefined") return;
    const sel = editor.getSelection();
    const block = sel
      ? editor.getJSON().content[sel.anchor.path[0] ?? 0]
      : null;
    const current = (block?.attrs?.caption as string) ?? "";
    const next = window.prompt("Caption (empty to remove)", current);
    if (next !== null) {
      editor.commands.updateImageAttrs?.({ caption: next });
    }
  };

  return (
    <div
      className="smeditor-toolbar smeditor-toolbar--context"
      role="toolbar"
      aria-label="Image toolbar"
      aria-orientation="horizontal"
    >
      <CommandButton
        label="Align left"
        commandName="setImageAlign"
        command={(e) => e.commands.setImageAlign?.({ align: "left" }) ?? false}
        isActive={() => currentAlign === "left"}
      >
        <IconAlignLeft />
      </CommandButton>
      <CommandButton
        label="Align center"
        commandName="setImageAlign"
        command={(e) => e.commands.setImageAlign?.({ align: "center" }) ?? false}
        isActive={() => currentAlign === "center"}
      >
        <IconAlignCenter />
      </CommandButton>
      <CommandButton
        label="Align right"
        commandName="setImageAlign"
        command={(e) => e.commands.setImageAlign?.({ align: "right" }) ?? false}
        isActive={() => currentAlign === "right"}
      >
        <IconAlignRight />
      </CommandButton>
      <ToolbarDivider />
      <CommandButton
        label="Edit alt text"
        commandName="updateImageAttrs"
        command={() => {
          editAlt();
          return true;
        }}
      >
        Alt
      </CommandButton>
      <CommandButton
        label="Edit caption"
        commandName="updateImageAttrs"
        command={() => {
          editCaption();
          return true;
        }}
      >
        Caption
      </CommandButton>
      <CommandButton
        label="Delete image"
        commandName="removeImage"
        command={(e) => e.commands.removeImage?.() ?? false}
      >
        <IconTrash />
      </CommandButton>
    </div>
  );
}

// ============================================================================
// Table — insert (§10) + contextual toolbar (§19)
// ============================================================================

const TABLE_PICKER_MAX = 6;

/**
 * Table insert button. The dropdown holds a hover grid — drag the
 * pointer across it to pick dimensions, click to insert. The same
 * pattern Word and Notion use.
 */
export function TableButton({ children }: { children?: ReactNode }) {
  const editor = useEditorContext();
  const [hover, setHover] = useState<{ rows: number; cols: number }>({
    rows: 0,
    cols: 0,
  });
  if (!editor || !hasCommand(editor, "insertTable")) return null;

  return (
    <Dropdown
      ariaLabel="Insert table"
      label={children ?? <IconTable />}
      disabled={!editor.isEditable()}
    >
      <div
        className="smeditor-table-picker"
        role="group"
        aria-label="Insert table size"
        onMouseLeave={() => setHover({ rows: 0, cols: 0 })}
      >
        {Array.from({ length: TABLE_PICKER_MAX }).map((_, r) =>
          Array.from({ length: TABLE_PICKER_MAX }).map((__, c) => {
            const on = r < hover.rows && c < hover.cols;
            return (
              <button
                key={`${r}-${c}`}
                type="button"
                className={[
                  "smeditor-table-picker__cell",
                  on ? "is-on" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-label={`Insert ${r + 1} by ${c + 1} table`}
                disabled={!editor.isEditable()}
                onMouseEnter={() => setHover({ rows: r + 1, cols: c + 1 })}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() =>
                  editor.commands.insertTable?.({
                    rows: r + 1,
                    cols: c + 1,
                  })
                }
              />
            );
          }),
        )}
      </div>
      <div className="smeditor-table-picker__label" aria-live="polite">
        {hover.rows > 0
          ? `${hover.rows} × ${hover.cols}`
          : "Pick table size"}
      </div>
    </Dropdown>
  );
}

/**
 * Contextual table toolbar — render it only when the caret is inside
 * a table (`editor.isActive("table")`). Covers the §19 table context
 * menu: add / remove rows and columns, toggle headers, cell background / align,
 * delete the table.
 */
export function TableToolbar() {
  const editor = useEditorContext();
  if (!editor || !editor.isActive("table")) return null;

  const cellAlign = currentCellAlign(editor);
  const cellBackground = currentCellBackground(editor);

  return (
    <div
      className="smeditor-toolbar smeditor-toolbar--context"
      role="toolbar"
      aria-label="Table toolbar"
      aria-orientation="horizontal"
    >
      <CommandButton
        label="Insert row above"
        commandName="addRowBefore"
        command={(e) => e.commands.addRowBefore?.() ?? false}
      >
        ↑ Row
      </CommandButton>
      <CommandButton
        label="Insert row below"
        commandName="addRowAfter"
        command={(e) => e.commands.addRowAfter?.() ?? false}
      >
        ↓ Row
      </CommandButton>
      <CommandButton
        label="Insert column left"
        commandName="addColumnBefore"
        command={(e) => e.commands.addColumnBefore?.() ?? false}
      >
        ← Col
      </CommandButton>
      <CommandButton
        label="Insert column right"
        commandName="addColumnAfter"
        command={(e) => e.commands.addColumnAfter?.() ?? false}
      >
        → Col
      </CommandButton>
      <ToolbarDivider />
      <CommandButton
        label="Delete row"
        commandName="deleteRow"
        command={(e) => e.commands.deleteRow?.() ?? false}
      >
        − Row
      </CommandButton>
      <CommandButton
        label="Delete column"
        commandName="deleteColumn"
        command={(e) => e.commands.deleteColumn?.() ?? false}
      >
        − Col
      </CommandButton>
      <ToolbarDivider />
      <CommandButton
        label="Merge selected cells"
        commandName="mergeCells"
        command={(e) => e.commands.mergeCells?.() ?? false}
      >
        Merge
      </CommandButton>
      <CommandButton
        label="Merge with cell to the right"
        commandName="mergeCellRight"
        command={(e) => e.commands.mergeCellRight?.() ?? false}
      >
        Merge →
      </CommandButton>
      <CommandButton
        label="Merge with cell below"
        commandName="mergeCellDown"
        command={(e) => e.commands.mergeCellDown?.() ?? false}
      >
        Merge ↓
      </CommandButton>
      <CommandButton
        label="Split merged cell"
        commandName="splitCell"
        command={(e) => e.commands.splitCell?.() ?? false}
      >
        Split
      </CommandButton>
      <ToolbarDivider />
      <CommandButton
        label="Toggle header row"
        commandName="toggleHeaderRow"
        command={(e) => e.commands.toggleHeaderRow?.() ?? false}
      >
        Header row
      </CommandButton>
      <CommandButton
        label="Toggle header column"
        commandName="toggleHeaderColumn"
        command={(e) => e.commands.toggleHeaderColumn?.() ?? false}
        isActive={(e) => e.isActive("table_cell", { header: true })}
      >
        Header col
      </CommandButton>
      {hasCommand(editor, "setCellAlign") && (
        <Dropdown
          ariaLabel="Cell alignment"
          label={<IconAlignLeft />}
          summary={cellAlign ?? "Cell"}
          active={Boolean(cellAlign)}
          disabled={!editor.isEditable()}
        >
          <DropdownItem
            active={cellAlign === "left"}
            onSelect={() => editor.commands.setCellAlign?.({ align: "left" })}
          >
            Align left
          </DropdownItem>
          <DropdownItem
            active={cellAlign === "center"}
            onSelect={() => editor.commands.setCellAlign?.({ align: "center" })}
          >
            Align center
          </DropdownItem>
          <DropdownItem
            active={cellAlign === "right"}
            onSelect={() => editor.commands.setCellAlign?.({ align: "right" })}
          >
            Align right
          </DropdownItem>
          <DropdownItem
            active={cellAlign === "justify"}
            onSelect={() => editor.commands.setCellAlign?.({ align: "justify" })}
          >
            Justify
          </DropdownItem>
          <DropdownSeparator />
          <DropdownItem onSelect={() => editor.commands.setCellAlign?.({ align: null })}>
            Clear cell alignment
          </DropdownItem>
        </Dropdown>
      )}
      {hasCommand(editor, "setCellBackground") && (
        <ColorPicker
          ariaLabel="Cell background"
          label={<IconBackgroundColor />}
          active={Boolean(cellBackground)}
          current={cellBackground}
          disabled={!editor.isEditable()}
          onPick={(color) => editor.commands.setCellBackground?.({ color })}
          onClear={() => editor.commands.setCellBackground?.({ color: null })}
        />
      )}
      <CommandButton
        label="Delete table"
        commandName="deleteTable"
        command={(e) => e.commands.deleteTable?.() ?? false}
      >
        <IconTrash />
      </CommandButton>
    </div>
  );
}

// ============================================================================
// Font family / size dropdowns (§5)
// ============================================================================

function markValue(editor: EditorInstance, mark: string, attr: string): string | null {
  const value = editor.getMarkAttributes(mark)?.[attr];
  return typeof value === "string" && value ? value : null;
}

function sameValue(a: string | null, b: string | null): boolean {
  const norm = (v: string | null) => (v ?? "").replace(/["'\s]/g, "").toLowerCase();
  return a !== null && b !== null && norm(a) === norm(b);
}

const FONT_FAMILIES: { label: string; value: string | null }[] = [
  { label: "Default", value: null },
  { label: "Sans-serif", value: "ui-sans-serif, system-ui, sans-serif" },
  { label: "Serif", value: "ui-serif, Georgia, serif" },
  { label: "Monospace", value: "ui-monospace, Menlo, monospace" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Courier", value: "'Courier New', monospace" },
];

/**
 * Font-family picker. "Default" clears the font_family mark; the rest
 * apply a stack. Each item previews itself in its own font.
 */
export function FontFamilyDropdown() {
  const editor = useEditorContext();
  if (!editor || !hasCommands(editor, ["setFontFamily", "unsetFontFamily"])) {
    return null;
  }
  return (
    <Dropdown
      ariaLabel="Font family"
      label={
        <span className="smeditor-dropdown__text">
          {FONT_FAMILIES.find((f) => f.value && sameValue(f.value, markValue(editor, "font_family", "family")))?.label ?? "Font"}
        </span>
      }
      active={editor.isActive("font_family")}
      disabled={!editor.isEditable()}
    >
      {FONT_FAMILIES.map((f) => (
        <DropdownItem
          key={f.label}
          active={
            f.value
              ? sameValue(f.value, markValue(editor, "font_family", "family"))
              : !editor.isActive("font_family")
          }
          onSelect={() =>
            f.value
              ? editor.commands.setFontFamily?.({ family: f.value })
              : editor.commands.unsetFontFamily?.()
          }
        >
          <span style={{ fontFamily: f.value ?? undefined }}>{f.label}</span>
        </DropdownItem>
      ))}
    </Dropdown>
  );
}

const FONT_SIZES: { label: string; value: string | null }[] = [
  { label: "Default", value: null },
  { label: "Small", value: "13px" },
  { label: "Normal", value: "16px" },
  { label: "Large", value: "20px" },
  { label: "Huge", value: "28px" },
];

/**
 * Font-size picker. "Default" clears the font_size mark.
 */
export function FontSizeDropdown() {
  const editor = useEditorContext();
  if (!editor || !hasCommands(editor, ["setFontSize", "unsetFontSize"])) {
    return null;
  }
  return (
    <Dropdown
      ariaLabel="Font size"
      label={<span className="smeditor-dropdown__text">{markValue(editor, "font_size", "size") ?? "Size"}</span>}
      active={editor.isActive("font_size")}
      disabled={!editor.isEditable()}
    >
      {FONT_SIZES.map((s) => (
        <DropdownItem
          key={s.label}
          active={
            s.value
              ? editor.isActive("font_size", { size: s.value })
              : !editor.isActive("font_size")
          }
          onSelect={() =>
            s.value
              ? editor.commands.setFontSize?.({ size: s.value })
              : editor.commands.unsetFontSize?.()
          }
        >
          {s.label}
          {s.value ? ` · ${s.value}` : ""}
        </DropdownItem>
      ))}
    </Dropdown>
  );
}

// ============================================================================
// Line-height dropdown (§5)
// ============================================================================

const LINE_HEIGHTS: { label: string; value: string | null }[] = [
  { label: "Default", value: null },
  { label: "Tight · 1", value: "1" },
  { label: "Snug · 1.15", value: "1.15" },
  { label: "Normal · 1.5", value: "1.5" },
  { label: "Relaxed · 2", value: "2" },
];

/**
 * Line-height picker. "Default" clears the lineHeight attr; the rest
 * apply a unitless multiplier to every block in the selection.
 */
export function LineHeightDropdown() {
  const editor = useEditorContext();
  if (!editor || !hasCommand(editor, "setLineHeight")) return null;
  const current = currentLineHeight(editor);
  return (
    <Dropdown
      ariaLabel="Line height"
      label={<span className="smeditor-dropdown__text">{current ?? "Spacing"}</span>}
      active={current !== null}
      disabled={!editor.isEditable()}
    >
      {LINE_HEIGHTS.map((lh) => (
        <DropdownItem
          key={lh.label}
          active={lh.value === current}
          onSelect={() => editor.commands.setLineHeight?.({ value: lh.value })}
        >
          {lh.label}
        </DropdownItem>
      ))}
    </Dropdown>
  );
}
