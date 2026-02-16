import { defineConfig } from "vite";
import { resolve } from "path";
import react from "@vitejs/plugin-react";

const sharedSrc = resolve(__dirname, "../../packages/shared/src");
const loaderEntry = resolve(__dirname, "src/loader.ts");

// Build only the HOST-PAGE loader (embed.js). This bundle must NOT import the
// widget UI (React App) to avoid leaking CSS/classes into customer websites.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@helvino/shared": resolve(sharedSrc, "index.ts"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      input: { embed: loaderEntry },
      output: {
        entryFileNames: "embed.js",
        format: "iife",
        inlineDynamicImports: true,
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith(".css")) return "embed.css";
          return "assets/[name]-[hash][extname]";
        },
      },
    },
  },
});

