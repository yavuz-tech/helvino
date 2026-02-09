import { defineConfig, build } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

const embedEntry = resolve(__dirname, "src/embed.tsx");
const sharedSrc = resolve(__dirname, "../../packages/shared/src");

/** In dev, serve /embed.js by building the embed entry in-memory using the same config (keeps workspace resolution). */
function embedDevPlugin() {
  return {
    name: "embed-dev",
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const url = req.url?.split("?")[0];
        if (url !== "/embed.js") return next();
        try {
          const out = await build({
            root: __dirname,
            configFile: false,
            resolve: {
              alias: { "@helvino/shared": resolve(sharedSrc, "index.ts") },
            },
            plugins: [react()],
            build: {
              write: false,
              rollupOptions: {
                input: { embed: embedEntry },
                output: {
                  entryFileNames: "embed.js",
                  format: "iife",
                  inlineDynamicImports: true,
                },
              },
            },
          });
          const chunk = (out as any).output?.find((o: any) => o.fileName === "embed.js" || o.name === "embed");
          const code = chunk?.type === "chunk" ? chunk.code : chunk?.code;
          if (!code) {
            res.statusCode = 500;
            return res.end("Failed to build embed.js");
          }
          res.setHeader("Content-Type", "application/javascript");
          res.end(code);
        } catch (e) {
          console.error("[embed-dev] build failed:", e);
          next(e);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), embedDevPlugin()],
  resolve: {
    alias: {
      "@helvino/shared": resolve(sharedSrc, "index.ts"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      input: { embed: embedEntry },
      output: {
        entryFileNames: "embed.js",
        format: "iife",
        inlineDynamicImports: true,
      },
    },
  },
});
