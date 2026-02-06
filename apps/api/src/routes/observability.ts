/**
 * Observability Routes
 * 
 * Health checks and metrics endpoints for production monitoring.
 */

import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { redis } from "../redis";
import { metricsTracker } from "../utils/metrics";
import { requireAdmin } from "../middleware/require-admin";

const startTime = Date.now();

interface HealthResponse {
  ok: boolean;
  db: "ok" | "down";
  redis: "ok" | "down";
  uptimeSec: number;
  timestamp: string;
}

export async function observabilityRoutes(fastify: FastifyInstance) {
  /**
   * GET /health
   * 
   * Health check with dependency verification.
   * No authentication required (public).
   * 
   * Returns:
   *   200: All dependencies healthy
   *   503: One or more dependencies down
   * 
   * Response:
   *   {
   *     ok: true/false,
   *     db: "ok"|"down",
   *     redis: "ok"|"down",
   *     uptimeSec: number,
   *     timestamp: ISO string
   *   }
   */
  fastify.get("/health", async (request, reply) => {
    let dbStatus: "ok" | "down" = "down";
    let redisStatus: "ok" | "down" = "down";

    // Check database connectivity
    try {
      await prisma.$queryRaw`SELECT 1 as result`;
      dbStatus = "ok";
    } catch (error) {
      request.log.error({ error }, "Database health check failed");
    }

    // Check Redis connectivity
    try {
      const pong = await redis.ping();
      if (pong === "PONG") {
        redisStatus = "ok";
      }
    } catch (error) {
      request.log.error({ error }, "Redis health check failed");
    }

    const ok = dbStatus === "ok" && redisStatus === "ok";
    const uptimeSec = Math.floor((Date.now() - startTime) / 1000);

    const response: HealthResponse = {
      ok,
      db: dbStatus,
      redis: redisStatus,
      uptimeSec,
      timestamp: new Date().toISOString(),
    };

    // Return 503 if any dependency is down
    if (!ok) {
      reply.code(503);
    }

    return response;
  });

  /**
   * GET /metrics
   * 
   * Production metrics (rolling 60-second window).
   * Requires admin authentication via session cookie.
   * 
   * Response:
   *   {
   *     req_total: number,
   *     req_2xx: number,
   *     req_4xx: number,
   *     req_5xx: number,
   *     rate_limited_429: number,
   *     avg_latency_ms: number,
   *     p95_latency_ms: number,
   *     bootloader_calls: number,
   *     conversations_posts: number,
   *     messages_posts: number,
   *     window_seconds: 60,
   *     timestamp: ISO string
   *   }
   */
  fastify.get("/metrics", {
    preHandler: [requireAdmin],
  }, async (request, reply) => {
    const snapshot = metricsTracker.getSnapshot();
    return snapshot;
  });

  /**
   * POST /metrics/test (INTERNAL)
   * Test metrics recording
   */
  fastify.post("/metrics/test", {
    preHandler: [requireAdmin],
  }, async (request, reply) => {
    // Manually record some test metrics
    metricsTracker.recordRequest(200, 100, "/test");
    metricsTracker.recordRequest(201, 150, "/conversations");
    metricsTracker.recordRequest(429, 50, "/conversations");
    metricsTracker.recordRequest(500, 200, "/api/bootloader");
    
    const snapshot = metricsTracker.getSnapshot();
    return { ok: true, message: "Test metrics recorded", snapshot };
  });
}
