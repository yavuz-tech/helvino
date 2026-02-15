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
 */
export async function embedRoutes(fastify: FastifyInstance) {
  fastify.get("/embed.js", async (_request, reply) => {
    // In the runner image, WORKDIR is /app/apps/api
    const filePath = path.join(process.cwd(), "..", "widget", "dist", "embed.js");

    try {
      const js = await fs.readFile(filePath);
      reply
        .header("Cache-Control", "public, max-age=3600")
        .type("application/javascript; charset=utf-8");
      return reply.send(js);
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
}

