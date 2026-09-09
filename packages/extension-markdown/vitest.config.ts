import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * The markdown extension's input-rules test imports runtime helpers from
 * `@smeditor/core` (`createEditor`), so the test run needs the package
 * resolved to its source rather than its unbuilt `dist` entry.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@smeditor/core": path.resolve(__dirname, "../core/src/index.ts"),
    },
  },
});
