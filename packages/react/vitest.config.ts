import { defineConfig } from "vitest/config";
import path from "node:path";

// Resolve workspace packages to their TypeScript sources so tests run
// against the current code without a build step. The MVP test imports
// `@smeditor/starter-kit`, which pulls in the whole extension graph, so
// every package it depends on is aliased here (mirroring the full-kit
// test config).
const pkg = (name: string, entry = "src/index.ts") =>
  path.resolve(__dirname, "..", name, entry);

export default defineConfig({
  test: {
    environment: "jsdom",
  },
  resolve: {
    alias: {
      "@smeditor/core": pkg("core"),
      "@smeditor/starter-kit": pkg("starter-kit"),
      "@smeditor/extension-background-color": pkg("extension-background-color"),
      "@smeditor/extension-blockquote": pkg("extension-blockquote"),
      "@smeditor/extension-bold": pkg("extension-bold"),
      "@smeditor/extension-bullet-list": pkg("extension-bullet-list"),
      "@smeditor/extension-clear-formatting": pkg("extension-clear-formatting"),
      "@smeditor/extension-code-block": pkg("extension-code-block"),
      "@smeditor/extension-comment": pkg("extension-comment"),
      "@smeditor/extension-font-family": pkg("extension-font-family"),
      "@smeditor/extension-font-size": pkg("extension-font-size"),
      "@smeditor/extension-hard-break": pkg("extension-hard-break"),
      "@smeditor/extension-heading": pkg("extension-heading"),
      "@smeditor/extension-highlight": pkg("extension-highlight"),
      "@smeditor/extension-history": pkg("extension-history"),
      "@smeditor/extension-horizontal-rule": pkg("extension-horizontal-rule"),
      "@smeditor/extension-image": pkg("extension-image"),
      "@smeditor/extension-indent": pkg("extension-indent"),
      "@smeditor/extension-inline-code": pkg("extension-inline-code"),
      "@smeditor/extension-italic": pkg("extension-italic"),
      "@smeditor/extension-line-height": pkg("extension-line-height"),
      "@smeditor/extension-link": pkg("extension-link"),
      "@smeditor/extension-list-item": pkg("extension-list-item"),
      "@smeditor/extension-markdown": pkg("extension-markdown"),
      "@smeditor/extension-mention": pkg("extension-mention"),
      "@smeditor/extension-ordered-list": pkg("extension-ordered-list"),
      "@smeditor/extension-paragraph": pkg("extension-paragraph"),
      "@smeditor/extension-placeholder": pkg("extension-placeholder"),
      "@smeditor/extension-strike": pkg("extension-strike"),
      "@smeditor/extension-subscript": pkg("extension-subscript"),
      "@smeditor/extension-superscript": pkg("extension-superscript"),
      "@smeditor/extension-table": pkg("extension-table"),
      "@smeditor/extension-task-item": pkg("extension-task-item"),
      "@smeditor/extension-task-list": pkg("extension-task-list"),
      "@smeditor/extension-text-align": pkg("extension-text-align"),
      "@smeditor/extension-text-color": pkg("extension-text-color"),
      "@smeditor/extension-text-stroke": pkg("extension-text-stroke"),
      "@smeditor/extension-track-changes": pkg("extension-track-changes"),
      "@smeditor/extension-underline": pkg("extension-underline"),
      "@smeditor/extension-word-count": pkg("extension-word-count"),
    },
  },
});
