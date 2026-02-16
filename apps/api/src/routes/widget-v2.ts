import { FastifyInstance } from "fastify";
import path from "path";
import fs from "fs/promises";

function noCacheHeaders(reply: any) {
  return reply
    .header("Access-Control-Allow-Origin", "*")
    .header("Cache-Control", "no-cache")
    .header("Pragma", "no-cache")
    .header("Expires", "0");
}

async function sendFile(reply: any, filePath: string, contentType: string) {
  const buf = await fs.readFile(filePath);
  noCacheHeaders(reply).type(contentType);
  return reply.send(buf);
}

export async function widgetV2Routes(fastify: FastifyInstance) {
  // In the runner image, WORKDIR is /app/apps/api  →  ../widget-v2/dist/*
  const distDir = path.join(process.cwd(), "..", "widget-v2", "dist");

  fastify.get("/widget-v2/loader.js", async (_request, reply) => {
    const filePath = path.join(distDir, "loader.js");
    return sendFile(reply, filePath, "application/javascript; charset=utf-8");
  });

  fastify.get("/widget-v2/loader.css", async (_request, reply) => {
    const filePath = path.join(distDir, "loader.css");
    return sendFile(reply, filePath, "text/css; charset=utf-8");
  });

  fastify.get("/widget-v2/frame.js", async (_request, reply) => {
    const filePath = path.join(distDir, "frame.js");
    return sendFile(reply, filePath, "application/javascript; charset=utf-8");
  });

  fastify.get("/widget-v2/frame.css", async (_request, reply) => {
    const filePath = path.join(distDir, "frame.css");
    return sendFile(reply, filePath, "text/css; charset=utf-8");
  });

  fastify.get("/widget-v2/frame.html", async (_request, reply) => {
    // OVERRIDE global helmet headers that block iframes (same approach as routes/embed.ts)
    try {
      const r = reply as unknown as { removeHeader?: (name: string) => void };
      r.removeHeader?.("X-Frame-Options");
    } catch {}

    // Allow embedding from customer websites.
    noCacheHeaders(reply)
      .header("X-Frame-Options", "ALLOWALL") // best-effort for legacy UAs
      .header(
        "Content-Security-Policy",
        [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data:",
          "connect-src 'self' https://api.helvion.io wss://api.helvion.io http://localhost:4000 ws://localhost:4000",
          "frame-ancestors *",
          "base-uri 'self'",
          "object-src 'none'",
        ].join("; ")
      )
      .type("text/html; charset=utf-8");

    const filePath = path.join(distDir, "frame.html");
    const htmlRaw = await fs.readFile(filePath, "utf8");
    // Vite builds with absolute /frame.js + /frame.css by default; rewrite for our mounted path.
    const html = htmlRaw
      .replace(/src=\"\\/frame\\.js\"/g, 'src="/widget-v2/frame.js"')
      .replace(/href=\"\\/frame\\.css\"/g, 'href="/widget-v2/frame.css"');

    return reply.send(html);
  });
}

