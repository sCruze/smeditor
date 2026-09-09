"use client";

import { useState } from "react";
import {
  BoldButton,
  BulletListButton,
  Editor,
  ItalicButton,
  LinkButton,
  OrderedListButton,
  RedoButton,
  Toolbar,
  ToolbarDivider,
  UndoButton,
} from "@smeditor/react";
import { StarterKit } from "@smeditor/starter-kit";

const initialContent = `
  <h2>SMEditor in Next.js</h2>
  <p>Use StarterKit in a client component, then save HTML and JSON from onUpdate.</p>
`;

export default function Page() {
  const [html, setHtml] = useState("");
  const [json, setJson] = useState("");

  return (
    <main style={{ display: "grid", gap: 24 }}>
      <header>
        <h1>SMEditor · Next.js example</h1>
        <p>
          App Router example with StarterKit, a small custom toolbar and live
          saved output.
        </p>
      </header>

      <Editor
        extensions={[StarterKit]}
        content={initialContent}
        onCreate={({ editor }) => {
          setHtml(editor.getHTML());
          setJson(JSON.stringify(editor.getJSON(), null, 2));
        }}
        onUpdate={({ html: nextHtml, json: nextJson }) => {
          setHtml(nextHtml);
          setJson(JSON.stringify(nextJson, null, 2));
        }}
        toolbar={() => (
          <Toolbar ariaLabel="Next.js example toolbar">
            <UndoButton />
            <RedoButton />
            <ToolbarDivider />
            <BoldButton />
            <ItalicButton />
            <LinkButton />
            <ToolbarDivider />
            <BulletListButton />
            <OrderedListButton />
          </Toolbar>
        )}
        contentAriaLabel="Next.js rich text editor"
      />

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        <article>
          <h2>HTML</h2>
          <pre style={{ overflow: "auto", whiteSpace: "pre-wrap" }}>{html}</pre>
        </article>
        <article>
          <h2>JSON</h2>
          <pre style={{ overflow: "auto", whiteSpace: "pre-wrap" }}>{json}</pre>
        </article>
      </section>
    </main>
  );
}
