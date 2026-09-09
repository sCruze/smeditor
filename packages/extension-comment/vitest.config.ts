import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * The comment extension imports runtime helpers from `@smeditor/core`
 * (`cloneDoc`, `selectionBlockRange`), so the test run needs the
 * package resolved to its source. In the pnpm workspace this is a
 * symlink; this alias makes `vitest run` work standalone too.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@smeditor/core": path.resolve(__dirname, "../core/src/index.ts"),
    },
  },
});
