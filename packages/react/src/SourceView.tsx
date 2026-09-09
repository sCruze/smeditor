/**
 * SourceView — a raw-HTML editing pane. The §11 "source mode".
 *
 * Shows the document's current HTML in a textarea. "Apply" parses the
 * edited HTML back into the editor (via `setContent`); "Revert"
 * reloads the textarea from the live document.
 *
 * It reads the editor from context, so drop it inside
 * `<EditorProvider>` — typically the host shows it *instead of*
 * `<EditorContent>` when a "source" toggle is on, but it works
 * alongside it too.
 *
 * HTML only — Markdown import/export lives in
 * `@smeditor/extension-markdown` (`toMarkdown` / `fromMarkdown`) so
 * this component stays free of an extension dependency.
 */

import { useEffect, useState } from "react";
import { useEditorContext } from "./Editor.js";

export interface SourceViewProps {
  /** Extra class on the wrapper. */
  className?: string;
  /** Called after a successful Apply. */
  onApply?: () => void;
}

export function SourceView({ className, onApply }: SourceViewProps) {
  const editor = useEditorContext();
  const [text, setText] = useState("");
  const [dirty, setDirty] = useState(false);

  // Load the document's HTML when the component mounts / the editor
  // changes. We don't live-sync after that — the textarea is the
  // user's working copy until they Apply or Revert.
  useEffect(() => {
    if (editor) {
      setText(editor.getHTML());
      setDirty(false);
    }
  }, [editor]);

  if (!editor) return null;

  const revert = () => {
    setText(editor.getHTML());
    setDirty(false);
  };
  const apply = () => {
    editor.commands.setContent?.(text);
    setDirty(false);
    onApply?.();
  };

  return (
    <div
      className={["smeditor-source-view", className]
        .filter(Boolean)
        .join(" ")}
    >
      <textarea
        className="smeditor-source-view__area"
        spellCheck={false}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setDirty(true);
        }}
        aria-label="Document HTML source"
      />
      <div className="smeditor-source-view__actions">
        <button
          type="button"
          className="smeditor-button"
          onClick={revert}
          disabled={!dirty}
        >
          Revert
        </button>
        <button
          type="button"
          className="smeditor-button"
          onClick={apply}
          disabled={!dirty}
        >
          Apply
        </button>
      </div>
    </div>
  );
}
