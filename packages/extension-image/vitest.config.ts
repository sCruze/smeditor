import { defineConfig } from "vitest/config";
import path from "node:path";

/** Image upload tests import @smeditor/core at runtime. */
export default defineConfig({
  resolve: {
    alias: {
      "@smeditor/core": path.resolve(__dirname, "../core/src/index.ts"),
    },
  },
});
