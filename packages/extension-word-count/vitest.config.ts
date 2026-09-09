import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * The word-count helpers import types from `@smeditor/core`. Alias the
 * package to its source so the test run resolves without a build step.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@smeditor/core": path.resolve(__dirname, "../core/src/index.ts"),
    },
  },
});
