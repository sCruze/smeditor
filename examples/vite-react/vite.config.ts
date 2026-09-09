import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = (name: string, entry = "src/index.ts") =>
  resolve(__dirname, "../../packages", name, entry);

const aliases: Record<string, string> = {
  "@smeditor/core": pkg("core"),
  "@smeditor/react": pkg("react", "src/index.tsx"),
  "@smeditor/starter-kit": pkg("starter-kit"),
  "@smeditor/full-kit": pkg("full-kit"),
  "@smeditor/extension-paragraph": pkg("extension-paragraph"),
  "@smeditor/extension-heading": pkg("extension-heading"),
  "@smeditor/extension-bold": pkg("extension-bold"),
  "@smeditor/extension-italic": pkg("extension-italic"),
  "@smeditor/extension-underline": pkg("extension-underline"),
  "@smeditor/extension-strike": pkg("extension-strike"),
  "@smeditor/extension-link": pkg("extension-link"),
  "@smeditor/extension-blockquote": pkg("extension-blockquote"),
  "@smeditor/extension-code-block": pkg("extension-code-block"),
  "@smeditor/extension-hard-break": pkg("extension-hard-break"),
  "@smeditor/extension-list-item": pkg("extension-list-item"),
  "@smeditor/extension-bullet-list": pkg("extension-bullet-list"),
  "@smeditor/extension-ordered-list": pkg("extension-ordered-list"),
  "@smeditor/extension-task-list": pkg("extension-task-list"),
  "@smeditor/extension-task-item": pkg("extension-task-item"),
  "@smeditor/extension-text-align": pkg("extension-text-align"),
  "@smeditor/extension-clear-formatting": pkg("extension-clear-formatting"),
  "@smeditor/extension-horizontal-rule": pkg("extension-horizontal-rule"),
  "@smeditor/extension-image": pkg("extension-image"),
  "@smeditor/extension-markdown": pkg("extension-markdown"),
  "@smeditor/extension-placeholder": pkg("extension-placeholder"),
  "@smeditor/extension-history": pkg("extension-history"),
  "@smeditor/extension-inline-code": pkg("extension-inline-code"),
  "@smeditor/extension-subscript": pkg("extension-subscript"),
  "@smeditor/extension-superscript": pkg("extension-superscript"),
  "@smeditor/extension-highlight": pkg("extension-highlight"),
  "@smeditor/extension-text-color": pkg("extension-text-color"),
  "@smeditor/extension-text-stroke": pkg("extension-text-stroke"),
  "@smeditor/extension-background-color": pkg("extension-background-color"),
  "@smeditor/extension-indent": pkg("extension-indent"),
  "@smeditor/extension-table": pkg("extension-table"),
  "@smeditor/extension-font-family": pkg("extension-font-family"),
  "@smeditor/extension-font-size": pkg("extension-font-size"),
  "@smeditor/extension-line-height": pkg("extension-line-height"),
  "@smeditor/extension-comment": pkg("extension-comment"),
  "@smeditor/extension-mention": pkg("extension-mention"),
  "@smeditor/extension-track-changes": pkg("extension-track-changes"),
  "@smeditor/extension-word-count": pkg("extension-word-count"),
  "@smeditor/theme-default": resolve(
    __dirname,
    "../../packages/theme-default/src/index.css",
  ),
};

export default defineConfig({
  plugins: [react()],
  resolve: { alias: aliases },
  optimizeDeps: { exclude: Object.keys(aliases) },
  server: {
    port: 3031,
  },
});
