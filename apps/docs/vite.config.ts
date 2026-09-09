import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The docs site is self-contained — it documents SMEditor but does
// not import it, so no workspace aliases are needed.
export default defineConfig({
  plugins: [react()],
  server: { port: 5181 },
});
