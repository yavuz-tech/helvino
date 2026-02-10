/**
 * Security Headers — Step 11.28
 *
 * Adds production-grade security headers to all API responses:
 * - X-Content-Type-Options: nosniff
 * - X-Frame-Options: DENY (API never needs framing)
 * - Referrer-Policy: strict-origin-when-cross-origin
 * - Permissions-Policy: restrictive defaults
 * - X-Request-Id: propagated from request context
 *
 * HSTS + CSP are now handled by @fastify/helmet in index.ts.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";

/**
 * Fastify plugin: security response headers.
 * Registered as an onSend hook so headers are set on every response.
 * Wrapped with fastify-plugin to apply globally (break encapsulation).
 */
export const securityHeadersPlugin = fp(async function securityHeadersPluginImpl(fastify: FastifyInstance) {
  fastify.addHook("onSend", async (request: FastifyRequest, reply: FastifyReply) => {
    // ── Universal headers ──

    // Prevent MIME type sniffing
    reply.header("X-Content-Type-Options", "nosniff");

    // API responses should never be framed
    reply.header("X-Frame-Options", "DENY");

    // Strict referrer policy
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");

    // Restrict browser features (API doesn't need any)
    reply.header(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), interest-cohort=()"
    );

    // Propagate request ID for debugging
    const requestId = request.requestId;
    if (requestId) {
      reply.header("X-Request-Id", requestId);
    }

  });
}, { name: "security-headers" });
