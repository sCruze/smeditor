import { describe, expect, it } from "vitest";
import { createEditor } from "@smeditor/core";
import { FullKit } from "../src/index.js";

describe("Advanced backlog boundary", () => {
  it("keeps Advanced/Pro commands out of the default FullKit bundle", () => {
    const editor = createEditor({
      extensions: [FullKit],
      content: "<p>Hello backlog</p>",
    });

    expect(editor.commands.addComment).toBeUndefined();
    expect(editor.commands.insertMention).toBeUndefined();
    expect(editor.commands.setTracking).toBeUndefined();
    expect(editor.commands.toggleTracking).toBeUndefined();
  });
});
