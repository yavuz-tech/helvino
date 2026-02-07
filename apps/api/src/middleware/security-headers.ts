/**
 * Security Headers — Step 11.28
 *
 * Adds production-grade security headers to all API responses:
 * - X-Content-Type-Options: nosniff
 * - X-Frame-Options: DENY (API never needs framing)
 * - Referrer-Policy: strict-origin-when-cross-origin
 * - Permissions-Policy: restrictive defaults
 * - X-Request-Id: propagated from request context
 * - Strict-Transport-Security: in production
 *
 * Separate CSP policies for admin/portal vs. widget/embed endpoints
 * are handled at the Next.js (web) layer, not the API.
 * The API focuses on response-level hardening.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";

const isProduction = process.env.NODE_ENV === "production";

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

    // ── Production-only headers ──

    if (isProduction) {
      // HSTS: enforce HTTPS for 1 year, include subdomains
      reply.header(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains"
      );
    }

    // ── Content-Security-Policy for API JSON responses ──
    // API only returns JSON, so a very restrictive CSP is fine.
    reply.header(
      "Content-Security-Policy",
      "default-src 'none'; frame-ancestors 'none'"
    );
  });
}, { name: "security-headers" });
