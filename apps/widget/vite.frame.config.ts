import { defineConfig } from "vite";
import { resolve } from "path";
import react from "@vitejs/plugin-react";

const sharedSrc = resolve(__dirname, "../../packages/shared/src");
const frameEntry = resolve(__dirname, "src/frame.tsx");

// Build the IFRAME UI bundle (widget-frame.js). This runs inside an iframe,
// so its CSS can be "global" without affecting customer websites.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@helvino/shared": resolve(sharedSrc, "index.ts"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: false, // do not wipe embed.js from the previous build
    cssCodeSplit: false, // inline CSS into JS for a single-file asset
    rollupOptions: {
      input: { frame: frameEntry },
      output: {
        entryFileNames: "widget-frame.js",
        format: "iife",
        inlineDynamicImports: true,
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith(".css")) return "widget-frame.css";
          return "assets/[name]-[hash][extname]";
        },
      },
    },
  },
});

