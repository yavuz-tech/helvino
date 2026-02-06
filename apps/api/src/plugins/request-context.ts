/**
 * Request Context Plugin
 * 
 * Adds request metadata for structured logging
 */

import { FastifyInstance, FastifyRequest } from "fastify";
import { randomUUID } from "crypto";

declare module "fastify" {
  interface FastifyRequest {
    requestId: string;
    startTime: number;
  }
}

export async function requestContextPlugin(fastify: FastifyInstance) {
  // Add request ID and start time to all requests
  fastify.addHook("onRequest", async (request: FastifyRequest) => {
    request.requestId = randomUUID();
    request.startTime = Date.now();
  });

  // Log request completion with structured data
  fastify.addHook("onResponse", async (request: FastifyRequest, reply) => {
    const latencyMs = Date.now() - request.startTime;
    const orgKey = request.headers["x-org-key"] as string || null;
    const visitorId = request.headers["x-visitor-id"] as string || null;
    const route = request.routeOptions?.url || request.url;

    fastify.log.info({
      requestId: request.requestId,
      method: request.method,
      url: request.url,
      route,
      statusCode: reply.statusCode,
      latencyMs,
      orgKey,
      visitorId,
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    }, "Request completed");
  });
}
