import { describe, expect, it, afterEach } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { createEditor } from "@smeditor/core";
import type { Extension } from "@smeditor/core";
import { BoldButton, EditorProvider, UndoButton } from "../src/index.js";

const BoldExtension: Extension = {
  name: "bold-test",
  marks: [
    {
      name: "bold",
      toDOM: () => ["strong", 0],
      parseDOM: [{ tag: "strong" }, { tag: "b" }],
    },
  ],
  commands: {
    toggleBold:
      () =>
      (editor) => {
        editor.commands.setContent("<p><strong>Bold</strong></p>");
        return true;
      },
  },
};

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

function renderToolbar(editor: ReturnType<typeof createEditor>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);

  act(() => {
    root.render(
      <EditorProvider editor={editor}>
        <UndoButton />
        <BoldButton />
      </EditorProvider>,
    );
  });

  return container;
}

describe("toolbar state", () => {
  it("rerenders disabled command state when the provider receives editor updates", () => {
    const editor = createEditor({ extensions: [BoldExtension] });
    const container = renderToolbar(editor);
    const undo = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Undo"]',
    );

    expect(undo).not.toBeNull();
    expect(undo?.disabled).toBe(true);

    act(() => {
      editor.commands.setContent("<p>Changed</p>");
    });

    expect(undo?.disabled).toBe(false);
  });

  it("does not render command buttons when the owning extension is absent", () => {
    const editor = createEditor({ extensions: [] });
    const container = renderToolbar(editor);

    expect(container.querySelector('button[aria-label="Bold"]')).toBeNull();
  });
});
