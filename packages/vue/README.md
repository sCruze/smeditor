# @smeditor/vue

Vue 3 bindings for the **SMEditor** rich text editor.

```bash
npm install @smeditor/vue @smeditor/starter-kit @smeditor/theme-default
```

> Requires Vue `>=3.3.0`.

## Quick start

```vue
<script setup lang="ts">
import { Editor } from "@smeditor/vue";
import { StarterKit } from "@smeditor/starter-kit";
import "@smeditor/theme-default";
</script>

<template>
  <Editor
    :extensions="[StarterKit]"
    content="<p>Hello world</p>"
    @update="({ html, json }) => console.log(html, json)"
  />
</template>
```

> Callbacks are also accepted as props: `:on-update`, `:on-create`,
> `:on-selection-update`, `:on-focus`, `:on-blur`, `:on-transaction`,
> `:on-destroy`.

## Composable layout

For a toolbar above the content surface, compose `useEditor` with
`<EditorContent>` and mount the editor yourself:

```vue
<script setup lang="ts">
import { ref, watchEffect } from "vue";
import { useEditor, EditorContent } from "@smeditor/vue";
import { StarterKit } from "@smeditor/starter-kit";

const host = ref<HTMLElement | null>(null);

// `element` accepts a ref or getter; the editor mounts once it resolves.
const { editor } = useEditor({
  element: host,
  extensions: [StarterKit],
  content: "<p>Hello</p>",
});

function toggleBold() {
  editor.value?.commands.toggleBold?.();
}
</script>

<template>
  <div class="smeditor">
    <div class="toolbar">
      <button type="button" @click="toggleBold">Bold</button>
    </div>
    <EditorContent :editor="editor" aria-label="Article body" />
  </div>
</template>
```

`EditorContent` renders the contenteditable surface and mounts the editor
into it for you — pass the `editor` ref from `useEditor` straight through:

```vue
<EditorContent :editor="editor" />
```

## Composable result

`useEditor(options)` returns:

| Field | Purpose |
| --- | --- |
| `editor` | A `shallowRef<EditorInstance \| null>` — `null` before creation / after teardown. |

The editor is created in `onMounted` (client only) and destroyed in
`onBeforeUnmount`. It is recreated, carrying the current document over,
when the extension set changes (for example StarterKit → FullKit) so
newly available commands start working. `deepSelection` defaults to `true`
unless you set it explicitly.

## Imperative access

```ts
const { editor } = useEditor({ extensions: [StarterKit] });

editor.value?.commands.setContent?.("<p>Replaced</p>");
editor.value?.commands.toggleBold?.();
editor.value?.getJSON();
editor.value?.getHTML();
```

See `@smeditor/core` for the headless API and extension model.
