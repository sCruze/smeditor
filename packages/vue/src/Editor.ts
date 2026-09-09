/**
 * <Editor> — drop-in all-in-one component.
 *
 * Mirrors the example in the technical brief:
 *
 *   <Editor
 *     :extensions="[StarterKit]"
 *     content="<p>Hello</p>"
 *     :on-update="({ html, json }) => …"
 *   />
 *
 * For more control compose `useEditor` + `<EditorContent>` yourself.
 *
 * Authored with `defineComponent` + an `h()` render function (no SFC) so
 * the package builds as plain TypeScript.
 */

import {
  defineComponent,
  h,
  ref,
  type PropType,
} from "vue";
import type {
  DocumentJSON,
  EditorInstance,
  EditorSelection,
  Extension,
  ExtensionBundle,
} from "@smeditor/core";
import { useEditor } from "./useEditor.js";

type EditorCtx<T> = (ctx: T) => void;

export const Editor = defineComponent({
  name: "Editor",
  props: {
    /** Extensions to load (flat extensions or bundles like StarterKit). */
    extensions: {
      type: Array as PropType<(Extension | ExtensionBundle)[]>,
      default: () => [],
    },
    /** Initial content — HTML string or DocumentJSON. */
    content: {
      type: [String, Object] as PropType<string | DocumentJSON>,
      default: undefined,
    },
    /** Read-only when false. Defaults to true. */
    editable: {
      type: Boolean,
      default: true,
    },
    /**
     * Opt in to deep selection paths. When left unset, `useEditor`
     * defaults it to `true`. Typed without a runtime `Boolean` so an
     * absent prop stays `undefined` (Vue would otherwise cast missing
     * boolean props to `false`, defeating "unless explicitly set").
     */
    deepSelection: {
      type: null as unknown as PropType<boolean | undefined>,
      default: undefined,
    },
    /** Placeholder text (consumed by the placeholder extension). */
    placeholder: {
      type: String,
      default: undefined,
    },
    /** Auto-focus on mount. Tri-state for the same reason as deepSelection. */
    autofocus: {
      type: null as unknown as PropType<boolean | undefined>,
      default: undefined,
    },
    /** Extra class applied to the root wrapper. */
    class: {
      type: String,
      default: undefined,
    },
    /** Accessible label for the editing surface. */
    contentAriaLabel: {
      type: String,
      default: "Rich text editor",
    },
    // Event callbacks (forwarded to core). Exposed as props so plain
    // `:on-update` works; Vue also surfaces them as `onUpdate` etc.
    onCreate: {
      type: Function as PropType<EditorCtx<{ editor: EditorInstance }>>,
      default: undefined,
    },
    onUpdate: {
      type: Function as PropType<
        EditorCtx<{ editor: EditorInstance; html: string; json: DocumentJSON }>
      >,
      default: undefined,
    },
    onSelectionUpdate: {
      type: Function as PropType<
        EditorCtx<{ editor: EditorInstance; selection: EditorSelection | null }>
      >,
      default: undefined,
    },
    onFocus: {
      type: Function as PropType<EditorCtx<{ editor: EditorInstance }>>,
      default: undefined,
    },
    onBlur: {
      type: Function as PropType<EditorCtx<{ editor: EditorInstance }>>,
      default: undefined,
    },
    onTransaction: {
      type: Function as PropType<EditorCtx<{ editor: EditorInstance }>>,
      default: undefined,
    },
    onDestroy: {
      type: Function as PropType<EditorCtx<{ editor: EditorInstance }>>,
      default: undefined,
    },
  },
  setup(props, { expose }) {
    const host = ref<HTMLDivElement | null>(null);

    const { editor } = useEditor({
      // `element` is a getter so the editor mounts to the host div once
      // the template ref is populated (after the first render / onMounted).
      element: () => host.value,
      get extensions() {
        return props.extensions;
      },
      get content() {
        return props.content;
      },
      get editable() {
        return props.editable;
      },
      get deepSelection() {
        return props.deepSelection;
      },
      get placeholder() {
        return props.placeholder;
      },
      get autofocus() {
        return props.autofocus;
      },
      onCreate: (ctx) => props.onCreate?.(ctx),
      onUpdate: (ctx) => props.onUpdate?.(ctx),
      onSelectionUpdate: (ctx) => props.onSelectionUpdate?.(ctx),
      onFocus: (ctx) => props.onFocus?.(ctx),
      onBlur: (ctx) => props.onBlur?.(ctx),
      onTransaction: (ctx) => props.onTransaction?.(ctx),
      onDestroy: (ctx) => props.onDestroy?.(ctx),
    });

    // Expose the live editor instance to template refs / parents.
    expose({ editor });

    return () =>
      h("div", { class: ["smeditor", props.class] }, [
        h("div", {
          ref: host,
          class: "smeditor-content",
          role: "textbox",
          "aria-label": props.contentAriaLabel,
          "aria-multiline": "true",
          "aria-readonly": props.editable ? "false" : "true",
          contenteditable: props.editable ? "true" : "false",
          tabindex: 0,
        }),
      ]);
  },
});

export default Editor;
