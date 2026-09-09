import { defineConfig } from "vitest/config";
import path from "node:path";

/** The track-changes tests import runtime helpers from @smeditor/core. */
export default defineConfig({
  resolve: {
    alias: {
      "@smeditor/core": path.resolve(__dirname, "../core/src/index.ts"),
    },
  },
});
