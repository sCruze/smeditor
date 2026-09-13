import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode, CSSProperties, ClipboardEvent, DragEvent } from "react";
import type { EditorInstance, EditorTheme } from "@smeditor/core";
import { useEditor, type UseEditorOptions } from "./useEditor.js";

/**
 * EditorContext lets toolbar buttons inside `<EditorProvider>` reach
 * the editor without prop drilling.
 */
interface EditorContextValue {
  editor: EditorInstance | null;
  version: number;
}

const EditorContext = createContext<EditorContextValue>({
  editor: null,
  version: 0,
});

export interface EditorProviderProps {
  editor: EditorInstance | null;
  children: ReactNode;
  /** Optional version from useEditor; provider also tracks editor events itself. */
  version?: number;
}

export function EditorProvider({
  editor,
  children,
  version = 0,
}: EditorProviderProps) {
  const [eventVersion, setEventVersion] = useState(0);

  useEffect(() => {
    setEventVersion((v) => v + 1);
    if (!editor) return;

    const bump = () => setEventVersion((v) => v + 1);
    const offUpdate = editor.on("update", bump);
    const offSelection = editor.on("selectionUpdate", bump);
    const offDestroy = editor.on("destroy", bump);

    return () => {
      offUpdate();
      offSelection();
      offDestroy();
    };
  }, [editor]);

  const value = useMemo(
    () => ({ editor, version: version + eventVersion }),
    [editor, eventVersion, version],
  );

  return (
    <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
  );
}

/** Hook for components nested under <EditorProvider>. */
export function useEditorContext(): EditorInstance | null {
  return useContext(EditorContext).editor;
}


function hasImageUploadCommand(editor: EditorInstance | null): boolean {
  return typeof editor?.commands.uploadImage === "function";
}

function imageFileFromTransfer(transfer: DataTransfer | null): File | null {
  if (!transfer) return null;

  for (const item of Array.from(transfer.items ?? [])) {
    if (item.kind !== "file" || !/^image\//i.test(item.type)) continue;
    const file = item.getAsFile();
    if (file) return file;
  }

  for (const file of Array.from(transfer.files ?? [])) {
    if (/^image\//i.test(file.type)) return file;
  }

  return null;
}

function uploadImageFromTransfer(
  editor: EditorInstance | null,
  transfer: DataTransfer | null,
): boolean {
  if (!hasImageUploadCommand(editor)) return false;
  const file = imageFileFromTransfer(transfer);
  if (!file) return false;
  return editor?.commands.uploadImage?.(file) ?? false;
}

// ============================================================================
// <EditorContent />
// ============================================================================

export interface EditorContentProps {
  editor: EditorInstance | null;
  className?: string;
  style?: CSSProperties;
  /** Visual theme. Falls back to the editor theme, then `light`. */
  theme?: EditorTheme;
  /** Accessible label for the editing surface. */
  ariaLabel?: string;
  /**
   * Toggle read-only mode. When `false`, the editor surface is rendered
   * with `contenteditable="false"` so users can't type. Buttons and
   * programmatic commands still work — the host app decides whether to
   * also disable them.
   *
   * Defaults to `true` (editable).
   */
  editable?: boolean;
}

/**
 * Renders the contenteditable surface and mounts the editor to it.
 * Separate from useEditor so you can compose layouts (toolbar above,
 * content below) without losing the contenteditable element.
 */
export const EditorContent = forwardRef<HTMLDivElement, EditorContentProps>(
  function EditorContent(
    {
      editor,
      className,
      style,
      theme,
      ariaLabel = "Rich text editor",
      editable,
    },
    ref,
  ) {
    const innerRef = useRef<HTMLDivElement | null>(null);
    useImperativeHandle(ref, () => innerRef.current as HTMLDivElement);
    const resolvedEditable = editable ?? editor?.isEditable() ?? true;
    const resolvedTheme = theme ?? editor?.options.theme ?? "light";

    useEffect(() => {
      if (!editor || !innerRef.current) return;
      editor.mount(innerRef.current);
      // The editor handles its own teardown in useEditor's cleanup.
    }, [editor]);

    // Keep the live contenteditable attribute in sync with the prop.
    // We do this in an effect (rather than as a prop on the div)
    // because the editor manages the surface after mount and we don't
    // want React to overwrite anything it sets there.
    useEffect(() => {
      if (!innerRef.current) return;
      innerRef.current.setAttribute(
        "contenteditable",
        resolvedEditable ? "true" : "false",
      );
    }, [resolvedEditable]);

    const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
      if (!resolvedEditable) return;
      if (uploadImageFromTransfer(editor, event.clipboardData)) {
        event.preventDefault();
      }
    };

    const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
      if (!resolvedEditable || !hasImageUploadCommand(editor)) return;
      if (imageFileFromTransfer(event.dataTransfer)) {
        event.preventDefault();
      }
    };

    const handleDrop = (event: DragEvent<HTMLDivElement>) => {
      if (!resolvedEditable) return;
      if (uploadImageFromTransfer(editor, event.dataTransfer)) {
        event.preventDefault();
      }
    };

    return (
      <div
        ref={innerRef}
        className={["smeditor-content", className].filter(Boolean).join(" ")}
        style={style}
        data-theme={resolvedTheme}
        role="textbox"
        aria-label={ariaLabel}
        aria-multiline="true"
        aria-readonly={!resolvedEditable}
        tabIndex={0}
        onPaste={handlePaste}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      />
    );
  },
);

// ============================================================================
// <Editor /> — convenience all-in-one
// ============================================================================

export interface EditorProps extends UseEditorOptions {
  className?: string;
  style?: CSSProperties;
  /** Render a toolbar above the content. Receives the editor instance. */
  toolbar?: (editor: EditorInstance) => ReactNode;
  /** Read-only when false. Defaults to true. */
  editable?: boolean;
  /** Accessible label for the editing surface. */
  contentAriaLabel?: string;
}

/**
 * Drop-in `<Editor />` component matching the example in the technical brief:
 *
 *   <Editor
 *     extensions={[StarterKit]}
 *     content="<p>Hello</p>"
 *     onUpdate={({ html, json }) => …}
 *   />
 *
 * For more control compose `useEditor` + `<EditorContent />` yourself.
 */
export function Editor({
  className,
  style,
  toolbar,
  editable,
  theme = "light",
  contentAriaLabel,
  ...editorOptions
}: EditorProps) {
  const { editor, version } = useEditor({
    ...editorOptions,
    editable,
    theme,
  });

  return (
    <EditorProvider editor={editor} version={version}>
      <div
        className={["smeditor", className].filter(Boolean).join(" ")}
        data-theme={theme}
      >
        {toolbar && editor ? toolbar(editor) : null}
        <EditorContent
          editor={editor}
          editable={editable}
          theme={theme}
          style={style}
          ariaLabel={contentAriaLabel}
        />
      </div>
    </EditorProvider>
  );
}
