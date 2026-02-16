import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig(({ mode }) => {
  if (mode === "loader") {
    return {
      build: {
        outDir: "dist",
        emptyOutDir: false,
        lib: {
          entry: resolve(__dirname, "src/loader.ts"),
          name: "HelvionWidget",
          fileName: () => "loader.js",
          formats: ["iife"],
        },
        cssCodeSplit: false,
        rollupOptions: {
          output: {
            assetFileNames: "loader.[ext]",
          },
        },
      },
    };
  }

  // mode === "frame"
  return {
    plugins: [
      react(),
      {
        name: "helvion-widget-v2-index-html",
        transformIndexHtml(html) {
          // Vite emits absolute /frame.* urls. We serve under /widget-v2/* on the API.
          return html
            .replaceAll('src="/frame.js"', 'src="/widget-v2/frame.js"')
            .replaceAll('href="/frame.css"', 'href="/widget-v2/frame.css"');
        },
      },
    ],
    root: resolve(__dirname, "src"),
    build: {
      outDir: resolve(__dirname, "dist"),
      emptyOutDir: false,
      rollupOptions: {
        input: {
          frame: resolve(__dirname, "src/frame.html"),
        },
        output: {
          entryFileNames: "frame.js",
          chunkFileNames: "frame-[hash].js",
          assetFileNames: (info) => {
            if (info.name?.endsWith(".css")) return "frame.css";
            return "assets/[name]-[hash][extname]";
          },
        },
      },
    },
  };
});
