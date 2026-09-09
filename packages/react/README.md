# @smeditor/react

React bindings for the **SMEditor** rich text editor.

```bash
npm install @smeditor/react @smeditor/starter-kit @smeditor/theme-default
```

## Quick start

```tsx
import { Editor } from "@smeditor/react";
import { StarterKit } from "@smeditor/starter-kit";
import "@smeditor/theme-default";

export default function Page() {
  return (
    <Editor
      extensions={[StarterKit]}
      content="<p>Hello world</p>"
      onUpdate={({ html, json }) => {
        console.log(html, json);
      }}
    />
  );
}
```

## Composable layout

For a toolbar above the content surface:

```tsx
import {
  useEditor,
  EditorProvider,
  EditorContent,
  Toolbar,
  BoldButton,
  ItalicButton,
  HeadingButton,
} from "@smeditor/react";
import { StarterKit } from "@smeditor/starter-kit";

function MyEditor() {
  const { editor, version } = useEditor({
    extensions: [StarterKit],
    content: "<p>Hello</p>",
  });

  return (
    <EditorProvider editor={editor} version={version}>
      <Toolbar>
        <BoldButton />
        <ItalicButton />
        <HeadingButton level={1} />
        <HeadingButton level={2} />
      </Toolbar>
      <EditorContent editor={editor} ariaLabel="Article body" />
    </EditorProvider>
  );
}
```

## Hook result

`useEditor(options)` returns:

| Field | Purpose |
| --- | --- |
| `editor` | The `EditorInstance`, or `null` before creation/after cleanup. |
| `version` | A number that increments on create, update and selection changes. |

Pass `version` to `EditorProvider` when composing custom layouts so
context consumers can refresh active/disabled toolbar state.

## Drop-in Editor props

`Editor` accepts all core `EditorOptions` except `element`, plus:

| Prop | Purpose |
| --- | --- |
| `toolbar` | Optional render prop receiving the editor instance. |
| `editable` | Toggles the contenteditable surface. |
| `contentAriaLabel` | Accessible label for the editor surface. |
| `className` / `style` | Applied to the root/content surface. |

## Toolbar

The package exports toolbar primitives and command-bound controls:

- `Toolbar`, `ToolbarDivider`.
- Mark buttons: `BoldButton`, `ItalicButton`, `UnderlineButton`,
  `StrikeButton`, `InlineCodeButton`, `SubscriptButton`,
  `SuperscriptButton`, `LinkButton`, `ClearFormattingButton`.
- Block buttons: `ParagraphButton`, `HeadingButton`, `BlockquoteButton`,
  `CodeBlockButton`, `HorizontalRuleButton`.
- Lists: `BulletListButton`, `OrderedListButton`, `TaskListButton`.
- Layout: `AlignLeftButton`, `AlignCenterButton`, `AlignRightButton`,
  `AlignJustifyButton`, `IndentButton`, `OutdentButton`.
- Dropdowns: `BlockTypeDropdown`, `HeadingsDropdown`, `ListsDropdown`,
  `AlignDropdown`, `FontFamilyDropdown`, `FontSizeDropdown`,
  `LineHeightDropdown`.
- Colors: `TextColorButton`, `TextStrokeButton`,
  `BackgroundColorButton`, `HighlightButton`.
- Rich content: `ImageButton`, `ImageToolbar`, `TableButton`,
  `TableToolbar`.
- History/read-only helpers: `UndoButton`, `RedoButton`,
  `EditableToggle`.

Buttons check command availability and editability before running their
commands. Controls whose extension command is not registered do not act
as silent no-ops.

## Contextual UI

The package also exports:

- `Dropdown`, `DropdownItem`, `DropdownSeparator`.
- `Floating`, `BubbleMenu`, `SlashMenu`, `MentionMenu`.
- `TrackChangesPanel`, `RemoteCursors`.
- `ImageResizer`, `TableColumnResizer`, `TableCellSelection`.
- `SourceView`.
- `icons` as small inline SVG components.

## Imperative access

```tsx
const { editor } = useEditor({ extensions: [StarterKit] });

editor?.commands.setContent?.("<p>Replaced</p>");
editor?.commands.toggleBold?.();
editor?.getJSON();
editor?.getHTML();
```

See `@smeditor/core` for the headless API and extension model.
