import { describe, expect, it, afterEach } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import type { ReactNode } from "react";
import { createEditor } from "@smeditor/core";
import {
  Dropdown,
  DropdownItem,
  EditorContent,
  Toolbar,
} from "../src/index.js";

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

describe("accessibility", () => {
  it("names toolbar regions and editor surfaces", () => {
    const editor = createEditor({ extensions: [] });
    const container = render(
      <>
        <Toolbar ariaLabel="Formatting toolbar">
          <span />
        </Toolbar>
        <EditorContent
          editor={editor}
          editable={false}
          ariaLabel="Article body"
        />
      </>,
    );

    expect(
      container.querySelector(
        '[role="toolbar"][aria-label="Formatting toolbar"]',
      ),
    ).not.toBeNull();

    const editorSurface = container.querySelector<HTMLElement>(
      '[role="textbox"][aria-label="Article body"]',
    );

    expect(editorSurface).not.toBeNull();
    expect(editorSurface?.getAttribute("aria-multiline")).toBe("true");
    expect(editorSurface?.getAttribute("aria-readonly")).toBe("true");
  });

  it("exposes dropdown menu state and item selection semantics", () => {
    const container = render(
      <Dropdown ariaLabel="Block type" label="Block">
        <DropdownItem active={true} onSelect={() => undefined}>
          Paragraph
        </DropdownItem>
        <DropdownItem disabled onSelect={() => undefined}>
          Heading
        </DropdownItem>
      </Dropdown>,
    );

    const trigger = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Block type"]',
    );
    expect(trigger).not.toBeNull();
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");

    act(() => {
      trigger?.click();
    });

    const menu = container.querySelector(
      '[role="menu"][aria-label="Block type"]',
    );
    const selected = container.querySelector(
      '[role="menuitemcheckbox"][aria-checked="true"]',
    );
    const disabled = container.querySelector(
      '[role="menuitem"][aria-disabled="true"]',
    );

    expect(trigger?.getAttribute("aria-expanded")).toBe("true");
    expect(menu).not.toBeNull();
    expect(selected).not.toBeNull();
    expect(disabled).not.toBeNull();
  });
});
