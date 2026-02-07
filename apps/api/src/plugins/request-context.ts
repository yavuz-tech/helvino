/**
 * Request Context Plugin
 * 
 * Adds request metadata for structured logging and traceability.
 * - Generates or propagates x-request-id
 * - Sets x-request-id response header
 * - Resolves actor type (admin / portal / widget / anon)
 * - Logs request start (debug) and completion (info)
 * - Global error handler for consistent error envelope
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { randomUUID } from "crypto";

declare module "fastify" {
  interface FastifyRequest {
    requestId: string;
    startTime: number;
    actorType: "admin" | "portal" | "widget" | "anon";
    actorId: string | null;
  }
}

/** Resolve the actor type and id from session / headers / request */
function resolveActor(request: FastifyRequest): {
  actorType: "admin" | "portal" | "widget" | "anon";
  actorId: string | null;
} {
  // Admin session
  if (request.session?.adminUserId) {
    return {
      actorType: "admin",
      actorId: request.session.adminEmail || request.session.adminUserId || null,
    };
  }
  // Portal user (set by requirePortalUser middleware, but may not be resolved yet)
  if ((request as any).portalUser) {
    return {
      actorType: "portal",
      actorId: (request as any).portalUser.email || (request as any).portalUser.id || null,
    };
  }
  // Org session (customer portal via session — orgUserId)
  if (request.session?.orgUserId) {
    return {
      actorType: "portal",
      actorId: request.session.orgUserId || null,
    };
  }
  // Widget (org token present)
  const orgToken = request.headers["x-org-token"] as string | undefined;
  if (orgToken) {
    return {
      actorType: "widget",
      actorId: request.headers["x-visitor-id"] as string || null,
    };
  }
  return { actorType: "anon", actorId: null };
}

async function requestContextPluginImpl(fastify: FastifyInstance) {
  // ── onRequest: generate/propagate requestId, resolve actor ──
  fastify.addHook("onRequest", async (request: FastifyRequest) => {
    // Prefer incoming x-request-id; generate if absent
    const incoming = request.headers["x-request-id"] as string | undefined;
    request.requestId = incoming && incoming.length > 0 && incoming.length <= 128
      ? incoming
      : randomUUID();
    request.startTime = Date.now();

    // Resolve actor (safe — session may not be initialised yet for some routes)
    try {
      const { actorType, actorId } = resolveActor(request);
      request.actorType = actorType;
      request.actorId = actorId;
    } catch (_e) {
      request.actorType = "anon";
      request.actorId = null;
    }
  });

  // ── onSend: attach x-request-id response header ──
  fastify.addHook("onSend", async (request: FastifyRequest, reply: FastifyReply) => {
    reply.header("x-request-id", request.requestId);
  });

  // ── onResponse: structured request-complete log ──
  fastify.addHook("onResponse", async (request: FastifyRequest, reply: FastifyReply) => {
    const latencyMs = Date.now() - request.startTime;
    const orgKey = request.headers["x-org-key"] as string || null;
    const siteId = request.headers["x-site-id"] as string || null;
    const route = request.routeOptions?.url || request.url;

    // Skip noisy health/metrics requests in logs
    if (route === "/health") return;

    fastify.log.info({
      msg: "req",
      requestId: request.requestId,
      method: request.method,
      url: request.url,
      route,
      statusCode: reply.statusCode,
      durationMs: latencyMs,
      actorType: request.actorType,
      actorId: request.actorId,
      orgKey,
      siteId,
      ip: request.ip,
    });
  });

  // ── Global error handler: consistent error envelope ──
  fastify.setErrorHandler(async (error: Error & { statusCode?: number; code?: string }, request: FastifyRequest, reply: FastifyReply) => {
    const statusCode = error.statusCode || 500;
    const isProduction = process.env.NODE_ENV === "production";

    // Log with context
    fastify.log.error({
      msg: "err",
      requestId: request.requestId,
      method: request.method,
      url: request.url,
      statusCode,
      actorType: request.actorType,
      actorId: request.actorId,
      errorCode: error.code || undefined,
      errorMessage: error.message,
      ...(isProduction ? {} : { stack: error.stack }),
    });

    // Standard error envelope
    reply.status(statusCode).send({
      error: {
        code: error.code || "INTERNAL_ERROR",
        message: statusCode >= 500 && isProduction
          ? "Internal server error"
          : error.message,
        requestId: request.requestId,
      },
    });
  });
}

// Wrap with fastify-plugin to break encapsulation so hooks apply globally
export const requestContextPlugin = fp(requestContextPluginImpl, {
  name: "request-context",
  fastify: ">=5.0.0",
});
