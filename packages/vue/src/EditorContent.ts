/**
 * <EditorContent> — renders the contenteditable surface and mounts the
 * editor to it. Kept separate from `useEditor` so hosts can compose
 * layouts (toolbar above, content below) without losing the
 * contenteditable element.
 *
 * Vue counterpart of `@smeditor/react`'s `EditorContent`. Authored with
 * `defineComponent` + an `h()` render function (no SFC) so the package
 * builds as plain TypeScript.
 */

import {
  defineComponent,
  h,
  onMounted,
  ref,
  watch,
  type PropType,
} from "vue";
import type { EditorInstance } from "@smeditor/core";

export const EditorContent = defineComponent({
  name: "EditorContent",
  props: {
    /** The editor instance produced by `useEditor` (may be null early). */
    editor: {
      type: Object as PropType<EditorInstance | null>,
      default: null,
    },
    /** Accessible label for the editing surface. */
    ariaLabel: {
      type: String,
      default: "Rich text editor",
    },
    /**
     * Toggle read-only mode. When `false`, the surface is rendered with
     * `contenteditable="false"` so users can't type. Programmatic
     * commands still work. Defaults to `true` (editable).
     */
    editable: {
      type: Boolean,
      default: true,
    },
  },
  setup(props) {
    const host = ref<HTMLDivElement | null>(null);

    const mountInto = (editor: EditorInstance | null) => {
      if (!editor || !host.value) return;
      // Calling mount twice on the same editor is a no-op in core.
      editor.mount(host.value);
    };

    onMounted(() => mountInto(props.editor));

    // Mount when the editor arrives (or is recreated) after first render.
    watch(
      () => props.editor,
      (editor) => mountInto(editor),
    );

    // Keep the live contenteditable attribute in sync with the prop. We
    // set it imperatively (not as a render prop) because the editor owns
    // the surface after mount and we don't want Vue to overwrite what it
    // sets there.
    watch(
      () => props.editable,
      (editable) => {
        if (!host.value) return;
        host.value.setAttribute(
          "contenteditable",
          editable ? "true" : "false",
        );
      },
    );

    return () =>
      h("div", {
        ref: host,
        class: "smeditor-content",
        role: "textbox",
        "aria-label": props.ariaLabel,
        "aria-multiline": "true",
        "aria-readonly": props.editable ? "false" : "true",
        tabindex: 0,
      });
  },
});

export default EditorContent;
