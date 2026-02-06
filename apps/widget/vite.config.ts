import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        embed: resolve(__dirname, "src/embed.tsx"),
      },
      output: {
        entryFileNames: "embed.js",
        format: "iife",
        inlineDynamicImports: true,
      },
    },
  },
});
