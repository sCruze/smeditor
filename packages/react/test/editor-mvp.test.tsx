import { afterEach, describe, expect, it } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { StrictMode, type ReactNode } from "react";
import type { EditorInstance } from "@smeditor/core";
import { StarterKit } from "@smeditor/starter-kit";
import { Editor, EditorContent, useEditor } from "../src/index.js";

let roots: Root[] = [];

afterEach(() => {
  for (const root of roots) {
    act(() => {
      root.unmount();
    });
  }
  roots = [];
  document.body.innerHTML = "";
});

function render(node: ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);

  act(() => {
    root.render(node);
  });

  return container;
}

describe("React MVP smoke", () => {
  it("mounts Editor with StarterKit, HTML content and onUpdate html/json payload", () => {
    const updates: Array<{ html: string; jsonType: string }> = [];
    const capturedEditors: EditorInstance[] = [];

    render(
      <Editor
        extensions={[StarterKit]}
        content="<p>Hello</p>"
        toolbar={(editor) => {
          capturedEditors.push(editor);
          return null;
        }}
        onUpdate={({ html, json }) => {
          updates.push({ html, jsonType: json.type });
        }}
      />,
    );

    const capturedEditor = capturedEditors[0];

    expect(capturedEditor).not.toBeUndefined();

    act(() => {
      capturedEditor?.commands.setContent("<p><strong>Updated</strong></p>");
    });

    expect(updates[updates.length - 1]).toEqual({
      html: "<p><strong>Updated</strong></p>",
      jsonType: "doc",
    });
  });

  it("stays alive and editable under React.StrictMode (double mount)", () => {
    const capturedEditors: EditorInstance[] = [];
    const updates: string[] = [];

    const container = render(
      <StrictMode>
        <Editor
          extensions={[StarterKit]}
          content="<p>Hello</p>"
          toolbar={(editor) => {
            capturedEditors.push(editor);
            return null;
          }}
          onUpdate={({ html }) => updates.push(html)}
        />
      </StrictMode>,
    );

    // The live editor is the most recently provided one (StrictMode's
    // first instance was torn down and replaced).
    const editor = capturedEditors[capturedEditors.length - 1];
    expect(editor).not.toBeUndefined();

    const surface = container.querySelector<HTMLElement>(".smeditor-content");
    expect(surface).not.toBeNull();

    // Simulate the user typing: the surface must still have live input
    // listeners (a destroyed instance would ignore this).
    act(() => {
      surface!.innerHTML = "<p>Hello world</p>";
      surface!.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(editor.getHTML()).toBe("<p>Hello world</p>");
    expect(updates[updates.length - 1]).toBe("<p>Hello world</p>");
  });

  it("passes editable=false from the convenience Editor into core and surface", () => {
    const capturedEditors: EditorInstance[] = [];
    const container = render(
      <Editor
        editable={false}
        extensions={[StarterKit]}
        content="<p>Read-only</p>"
        toolbar={(editor) => {
          capturedEditors.push(editor);
          return null;
        }}
      />,
    );

    const surface = container.querySelector<HTMLElement>(".smeditor-content");

    expect(capturedEditors[0]?.options.editable).toBe(false);
    expect(surface?.getAttribute("contenteditable")).toBe("false");
    expect(surface?.getAttribute("aria-readonly")).toBe("true");
  });

  it("defaults to the light theme and allows an explicit dark theme", () => {
    const lightContainer = render(
      <Editor extensions={[StarterKit]} content="<p>Light</p>" />,
    );
    const darkContainer = render(
      <Editor theme="dark" extensions={[StarterKit]} content="<p>Dark</p>" />,
    );

    expect(
      lightContainer.querySelector(".smeditor")?.getAttribute("data-theme"),
    ).toBe("light");
    expect(
      lightContainer.querySelector(".smeditor-content")?.getAttribute("data-theme"),
    ).toBe("light");
    expect(
      darkContainer.querySelector(".smeditor")?.getAttribute("data-theme"),
    ).toBe("dark");
    expect(
      darkContainer.querySelector(".smeditor-content")?.getAttribute("data-theme"),
    ).toBe("dark");
  });

  it("keeps useEditor editable=false when EditorContent has no editable prop", () => {
    function ReadOnlyEditor() {
      const { editor } = useEditor({
        extensions: [StarterKit],
        content: "<p>Read-only</p>",
        editable: false,
      });

      return <EditorContent editor={editor} />;
    }

    const container = render(<ReadOnlyEditor />);
    const surface = container.querySelector<HTMLElement>(".smeditor-content");

    expect(surface?.getAttribute("contenteditable")).toBe("false");
    expect(surface?.getAttribute("aria-readonly")).toBe("true");
  });
});
