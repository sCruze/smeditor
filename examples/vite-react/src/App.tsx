import { useMemo, useState } from "react";
import type { Extension } from "@smeditor/core";
import { FullKit } from "@smeditor/full-kit";
import { ImageExtension } from "@smeditor/extension-image";
import {
  AlignDropdown,
  BackgroundColorButton,
  BlockTypeDropdown,
  BoldButton,
  BulletListButton,
  ClearFormattingButton,
  CodeBlockButton,
  Editor,
  FontFamilyDropdown,
  FontSizeDropdown,
  HighlightButton,
  ImageButton,
  ItalicButton,
  LineHeightDropdown,
  LinkButton,
  OrderedListButton,
  RedoButton,
  TableButton,
  TableToolbar,
  TextColorButton,
  TextStrokeButton,
  Toolbar,
  ToolbarDivider,
  UndoButton,
  type EditorInstance,
} from "@smeditor/react";

const initialContent = `
  <h2>SMEditor Vite React example</h2>
  <p><strong>Edit this content</strong>, insert a table, upload an image, then inspect the saved HTML and JSON.</p>
  <blockquote><p style="text-align:center">Blockquote alignment round-trip check.</p></blockquote>
  <table><tbody><tr><th>Feature</th><th>Status</th></tr><tr><td>Tables</td><td>Ready</td></tr></tbody></table>
`;

type UploadResult = {
  src: string;
  alt: string;
};

function readImage(file: File): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      resolve({ src: String(reader.result), alt: file.name });
    });
    reader.addEventListener("error", () => {
      reject(reader.error ?? new Error("Image upload failed"));
    });
    reader.readAsDataURL(file);
  });
}

function outputFor(editor: EditorInstance | null) {
  if (!editor) {
    return { html: "", json: "" };
  }

  return {
    html: editor.getHTML(),
    json: JSON.stringify(editor.getJSON(), null, 2),
  };
}

export function App() {
  const [html, setHtml] = useState("");
  const [json, setJson] = useState("");

  const extensions = useMemo(() => {
    const configuredImage = ImageExtension.configure?.({ upload: readImage }) ?? ImageExtension;
    return [
      {
        ...FullKit,
        extensions: [
          ...FullKit.extensions.filter((extension: Extension) => extension.name !== "image"),
          configuredImage,
        ],
      },
    ];
  }, []);

  const captureOutput = (editor: EditorInstance | null) => {
    const next = outputFor(editor);
    setHtml(next.html);
    setJson(next.json);
  };

  return (
    <main className="example-shell">
      <header className="example-header">
        <p className="example-eyebrow">SMEditor example</p>
        <h1>Vite React editor</h1>
        <p>
          FullKit editor with a custom toolbar, local image upload, tables and
          live HTML/JSON output.
        </p>
      </header>

      <section className="example-card" aria-label="Editor demo">
        <Editor
          extensions={extensions}
          content={initialContent}
          onCreate={({ editor }) => captureOutput(editor)}
          onUpdate={({ editor, html: nextHtml, json: nextJson }) => {
            setHtml(nextHtml);
            setJson(JSON.stringify(nextJson, null, 2));
            captureOutput(editor);
          }}
          toolbar={(editor) => (
            <>
              <Toolbar ariaLabel="Vite React editor toolbar">
                <UndoButton />
                <RedoButton />
                <ToolbarDivider />
                <BlockTypeDropdown />
                <BoldButton />
                <ItalicButton />
                <LinkButton />
                <TextColorButton />
                <BackgroundColorButton />
                <HighlightButton />
                <TextStrokeButton />
                <ClearFormattingButton />
                <ToolbarDivider />
                <BulletListButton />
                <OrderedListButton />
                <CodeBlockButton />
                <AlignDropdown />
                <FontFamilyDropdown />
                <FontSizeDropdown />
                <LineHeightDropdown />
                <ToolbarDivider />
                <ImageButton />
                <TableButton />
              </Toolbar>
              <TableToolbar />
              <div className="example-actions">
                <button type="button" onClick={() => editor.commands.insertTable?.({ rows: 3, cols: 3, withHeaderRow: true })}>
                  Insert demo table
                </button>
                <button type="button" onClick={() => captureOutput(editor)}>
                  Save HTML/JSON
                </button>
              </div>
            </>
          )}
          contentAriaLabel="Vite React rich text editor"
        />
      </section>

      <section className="output-grid" aria-label="Saved editor output">
        <article className="output-panel">
          <h2>HTML</h2>
          <pre>{html}</pre>
        </article>
        <article className="output-panel">
          <h2>JSON</h2>
          <pre>{json}</pre>
        </article>
      </section>
    </main>
  );
}
