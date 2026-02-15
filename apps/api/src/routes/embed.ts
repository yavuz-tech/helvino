import { FastifyInstance } from "fastify";
import path from "path";
import fs from "fs/promises";

/**
 * Serve widget embed script from the API.
 *
 * Expected location in production image:
 *   /app/apps/widget/dist/embed.js
 *
 * Dockerfile ensures the widget is built and copied.
 *
 * CORS: Access-Control-Allow-Origin: * — the embed script must be
 *       loadable from ANY customer website.
 * Cache: public, max-age=3600 (1 hour).
 */

/** Cached buffer so we don't hit the filesystem on every request. */
let cachedJs: Buffer | null = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // re-read from disk every 5 minutes

export async function embedRoutes(fastify: FastifyInstance) {
  // ── Serve embed.js ──
  fastify.get("/embed.js", async (_request, reply) => {
    // In the runner image, WORKDIR is /app/apps/api  →  ../widget/dist/embed.js
    const filePath = path.join(process.cwd(), "..", "widget", "dist", "embed.js");

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
        .header("Cache-Control", "public, max-age=300, s-maxage=300")
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
            : "Widget embed build missing. Run: pnpm --filter @helvino/widget build",
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
}

