import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * The table extension's index imports runtime helpers from
 * @smeditor/core (nodeAt, descendToLeafPath, cloneDoc), so the test
 * run needs the package resolved to its source.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@smeditor/core": path.resolve(__dirname, "../core/src/index.ts"),
    },
  },
});
