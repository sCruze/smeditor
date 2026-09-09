import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * The link extension imports runtime helpers from `@smeditor/core`
 * (`cloneDoc`, `nodeAt`, `setMarkOnInlineRange`, …), and the autolink
 * test drives a real editor that needs a paragraph node, so both
 * packages are resolved to their source.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@smeditor/core": path.resolve(__dirname, "../core/src/index.ts"),
      "@smeditor/extension-paragraph": path.resolve(
        __dirname,
        "../extension-paragraph/src/index.ts",
      ),
    },
  },
});
