# @smeditor/core

Framework-agnostic core of the **SMEditor** rich-text editor.

This package has no dependency on React, Vue, Rails, Next.js or any UI
framework. It exposes the editor engine, schema/extension system,
command system, selection model, history, events and JSON ↔ HTML
serializers.

## Install

```bash
npm install @smeditor/core @smeditor/starter-kit
```

## Headless usage

```ts
import { createEditor } from "@smeditor/core";
import { StarterKit } from "@smeditor/starter-kit";

const editor = createEditor({
  content: "<p>Hello world</p>",
  extensions: [StarterKit],
});

console.log(editor.getJSON());
console.log(editor.getHTML());
```

## Mounted usage

```ts
import { createEditor } from "@smeditor/core";
import { StarterKit } from "@smeditor/starter-kit";

const el = document.getElementById("editor")!;
const editor = createEditor({
  element: el,
  content: "<p>Hello</p>",
  extensions: [StarterKit],
  theme: "light", // default; use "dark" for the dark theme
  onUpdate: ({ html, json }) => {
    console.log("changed:", html, json);
  },
});
```

## EditorInstance API

| API | Purpose |
| --- | --- |
| `getJSON()` / `getHTML()` | Read the current document as cloned JSON or serialized HTML. |
| `setContent(content)` | Replace the document from HTML or `DocumentJSON`. |
| `getSelection()` / `setSelection(selection)` | Read or set editor selection. |
| `coordsAtPoint(point)` | Resolve mounted selection coordinates for overlays. |
| `focus()` / `blur()` / `destroy()` | Lifecycle methods. |
| `mount(element)` | Attach an existing editor instance to a DOM element. |
| `isEditable()` | Read editability state. |
| `canUndo()` / `canRedo()` | Read history availability. |
| `isActive(name, attrs?)` | Query active node/mark state for UI. |
| `on(event, handler)` | Subscribe to lifecycle/update/selection events. |
| `dispatch(transaction)` | Apply a transaction; primarily for extensions. |

## Document model

The document source of truth is JSON:

```json
{
  "type": "doc",
  "content": [
    {
      "type": "paragraph",
      "content": [
        { "type": "text", "text": "Hello", "marks": [{ "type": "bold" }] }
      ]
    }
  ]
}
```

Core registers only `doc` and `text`. Every other node or mark is
contributed by extensions.

## Extensions

An extension can contribute:

- `nodes` and `marks` with `toDOM` / `parseDOM` rules.
- `commands` exposed on `editor.commands`.
- `keyboardShortcuts`.
- `inputRules`.
- `transformPastedHTML`.
- `handleTextInput` / `handleDeleteContent`.
- `onCreate` / `onDestroy` lifecycle hooks.
- `configure(options)` to produce a configured copy.

## Events

Supported event names are:

- `create`
- `update`
- `focus`
- `blur`
- `selectionUpdate`
- `transaction`
- `destroy`

Subscribe with `editor.on(event, handler)`. The method returns an
unsubscribe callback.

## Serializer

Use `parseHTML(html, schema)` and `serializeToHTML(doc, schema)` for
explicit conversion, or `editor.setContent`, `editor.getHTML` and
`editor.getJSON` through the instance API. Serialization is schema-driven:
only the active extensions define which nodes and marks can round-trip.

## Status

Pre-alpha. APIs may change between 0.0.x releases.
