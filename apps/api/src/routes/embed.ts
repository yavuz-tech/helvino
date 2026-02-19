import { FastifyInstance } from "fastify";
import path from "path";
import fs from "fs/promises";

/**
 * Serve widget assets from the API.
 *
 * Files are built by apps/widget-v2 (Vite) and copied into the API image:
 *   /app/apps/widget-v2/dist/loader.js   (host-page loader)
 *   /app/apps/widget-v2/dist/frame.js    (iframe UI bundle)
 *
 * IMPORTANT:
 * - embed.js must be loadable from ANY customer website
 * - widget-frame.html MUST be embeddable in an iframe
 *   (Helmet frameguard/CSP is "deny"/"frame-ancestors 'none'" globally)
 */

/** Cached buffer so we don't hit the filesystem on every request. */
let cachedJs: Buffer | null = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 30 * 1000; // re-read from disk every 30 seconds

let cachedFrameJs: Buffer | null = null;
let frameCacheLoadedAt = 0;

let cachedEmbedCss: Buffer | null = null;
let embedCssLoadedAt = 0;
let cachedFrameCss: Buffer | null = null;
let frameCssLoadedAt = 0;

export async function embedRoutes(fastify: FastifyInstance) {
  // ── Serve embed.js ──
  fastify.get("/embed.js", async (_request, reply) => {
    // In the runner image, WORKDIR is /app/apps/api -> ../widget-v2/dist/loader.js
    const filePath = path.join(process.cwd(), "..", "widget-v2", "dist", "loader.js");

    try {
      const now = Date.now();
      if (!cachedJs || now - cacheLoadedAt > CACHE_TTL_MS) {
        cachedJs = await fs.readFile(filePath);
        cacheLoadedAt = now;
      }

      reply
        // CORS: must be loadable from any customer domain
        .header("Access-Control-Allow-Origin", "*")
        .header("Access-Control-Allow-Methods", "GET, OPTIONS")
        // Allow cross-origin embedding (fixes ERR_BLOCKED_BY_RESPONSE.NotSameOrigin)
        .header("Cross-Origin-Resource-Policy", "cross-origin")
        // IMPORTANT:
        // Cloudflare can override browser cache TTL for embed.js. We still send
        // no-store to discourage browser caching as much as possible.
        .header("Cache-Control", "no-store")
        .header("Pragma", "no-cache")
        .header("Expires", "0")
        .header("X-Content-Type-Options", "nosniff")
        .type("application/javascript; charset=utf-8");
      return reply.send(cachedJs);
    } catch (err) {
      fastify.log.warn(
        { err: err instanceof Error ? err.message : String(err), filePath },
        "embed.js not found"
      );
      const isProduction = process.env.NODE_ENV === "production";
      // SECURITY: Avoid leaking build/deploy instructions in production.
      reply.code(isProduction ? 404 : 500);
      return reply.send({
        error: {
          code: "EMBED_BUILD_MISSING",
          message: isProduction
            ? "Not found"
            : "Widget embed build missing. Run: pnpm --filter @helvino/widget-v2 build",
        },
      });
    }
  });

  // ── CORS preflight for embed.js ──
  fastify.options("/embed.js", async (_request, reply) => {
    reply
      .header("Access-Control-Allow-Origin", "*")
      .header("Access-Control-Allow-Methods", "GET, OPTIONS")
      .header("Cross-Origin-Resource-Policy", "cross-origin")
      .header("Access-Control-Max-Age", "86400")
      .code(204)
      .send();
  });

  // ── Serve iframe UI bundle ──
  fastify.get("/widget-frame.js", async (_request, reply) => {
    const filePath = path.join(process.cwd(), "..", "widget-v2", "dist", "frame.js");
    try {
      const now = Date.now();
      if (!cachedFrameJs || now - frameCacheLoadedAt > CACHE_TTL_MS) {
        cachedFrameJs = await fs.readFile(filePath);
        frameCacheLoadedAt = now;
      }

      reply
        .header("Access-Control-Allow-Origin", "*")
        .header("Access-Control-Allow-Methods", "GET, OPTIONS")
        .header("Cross-Origin-Resource-Policy", "cross-origin")
        .header("Cache-Control", "no-store")
        .header("Pragma", "no-cache")
        .header("Expires", "0")
        .header("X-Content-Type-Options", "nosniff")
        .type("application/javascript; charset=utf-8");
      return reply.send(cachedFrameJs);
    } catch (err) {
      fastify.log.warn({ err: err instanceof Error ? err.message : String(err), filePath }, "widget-frame.js not found");
      reply.code(404);
      return reply.send({ error: { code: "WIDGET_FRAME_BUILD_MISSING", message: "Not found" } });
    }
  });

  fastify.options("/widget-frame.js", async (_request, reply) => {
    reply
      .header("Access-Control-Allow-Origin", "*")
      .header("Access-Control-Allow-Methods", "GET, OPTIONS")
      .header("Cross-Origin-Resource-Policy", "cross-origin")
      .header("Access-Control-Max-Age", "86400")
      .code(204)
      .send();
  });

  // ── Serve loader CSS (scoped) ──
  fastify.get("/embed.css", async (_request, reply) => {
    const filePath = path.join(process.cwd(), "..", "widget-v2", "dist", "loader.css");
    try {
      const now = Date.now();
      if (!cachedEmbedCss || now - embedCssLoadedAt > CACHE_TTL_MS) {
        cachedEmbedCss = await fs.readFile(filePath);
        embedCssLoadedAt = now;
      }
      reply
        .header("Access-Control-Allow-Origin", "*")
        .header("Access-Control-Allow-Methods", "GET, OPTIONS")
        .header("Cross-Origin-Resource-Policy", "cross-origin")
        .header("Cache-Control", "no-store")
        .header("Pragma", "no-cache")
        .header("Expires", "0")
        .header("X-Content-Type-Options", "nosniff")
        .type("text/css; charset=utf-8");
      return reply.send(cachedEmbedCss);
    } catch (err) {
      fastify.log.warn({ err: err instanceof Error ? err.message : String(err), filePath }, "embed.css not found");
      reply.code(404);
      return reply.send("/* not found */");
    }
  });

  fastify.options("/embed.css", async (_request, reply) => {
    reply
      .header("Access-Control-Allow-Origin", "*")
      .header("Access-Control-Allow-Methods", "GET, OPTIONS")
      .header("Cross-Origin-Resource-Policy", "cross-origin")
      .header("Access-Control-Max-Age", "86400")
      .code(204)
      .send();
  });

  // ── Serve iframe CSS ──
  fastify.get("/widget-frame.css", async (_request, reply) => {
    const filePath = path.join(process.cwd(), "..", "widget-v2", "dist", "frame.css");
    try {
      const now = Date.now();
      if (!cachedFrameCss || now - frameCssLoadedAt > CACHE_TTL_MS) {
        cachedFrameCss = await fs.readFile(filePath);
        frameCssLoadedAt = now;
      }
      reply
        .header("Access-Control-Allow-Origin", "*")
        .header("Access-Control-Allow-Methods", "GET, OPTIONS")
        .header("Cross-Origin-Resource-Policy", "cross-origin")
        .header("Cache-Control", "no-store")
        .header("Pragma", "no-cache")
        .header("Expires", "0")
        .header("X-Content-Type-Options", "nosniff")
        .type("text/css; charset=utf-8");
      return reply.send(cachedFrameCss);
    } catch (err) {
      fastify.log.warn({ err: err instanceof Error ? err.message : String(err), filePath }, "widget-frame.css not found");
      reply.code(404);
      return reply.send("/* not found */");
    }
  });

  fastify.options("/widget-frame.css", async (_request, reply) => {
    reply
      .header("Access-Control-Allow-Origin", "*")
      .header("Access-Control-Allow-Methods", "GET, OPTIONS")
      .header("Cross-Origin-Resource-Policy", "cross-origin")
      .header("Access-Control-Max-Age", "86400")
      .code(204)
      .send();
  });

  // ── Serve iframe HTML shell (embeddable) ──
  fastify.get("/widget-frame.html", async (_request, reply) => {
    // OVERRIDE global helmet headers that block iframes
    try {
      // Fastify's Reply type may not expose removeHeader, but Node's ServerResponse does.
      // Use a safe runtime check without TS directives.
      const r = reply as unknown as { removeHeader?: (name: string) => void };
      r.removeHeader?.("X-Frame-Options");
    } catch {}

    // Allow embedding from customer websites.
    reply
      .header(
        "Content-Security-Policy",
        [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data:",
          "connect-src 'self' https://api.helvion.io wss://api.helvion.io",
          "frame-ancestors *",
          "base-uri 'self'",
          "object-src 'none'",
        ].join("; ")
      )
      .header("Cross-Origin-Resource-Policy", "cross-origin")
      .header("Cache-Control", "no-store")
      .header("Pragma", "no-cache")
      .header("Expires", "0")
      .type("text/html; charset=utf-8");

    const filePath = path.join(process.cwd(), "..", "widget-v2", "dist", "frame.html");
    try {
      const html = await fs.readFile(filePath, "utf8");
      return reply.send(html);
    } catch (err) {
      fastify.log.warn({ err: err instanceof Error ? err.message : String(err), filePath }, "widget-v2 frame.html not found");
      reply.code(404);
      return reply.send("<!-- not found -->");
    }
  });
}

