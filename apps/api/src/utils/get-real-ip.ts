/**
 * Secure IP extraction utility.
 *
 * IMPORTANT: This relies on Fastify's `trustProxy` setting (configured in index.ts)
 * to safely resolve the client IP from proxy headers. When `trustProxy` is set,
 * `request.ip` already contains the correct client IP after Fastify validates
 * the proxy chain. We must NOT manually parse X-Forwarded-For or X-Real-IP
 * because those headers can be spoofed by untrusted clients to bypass rate limiting.
 *
 * The only exception is `cf-connecting-ip` which is set by Cloudflare's edge
 * and is trustworthy when the application is behind Cloudflare (Cloudflare strips
 * any client-set cf-connecting-ip header).
 */

import { FastifyRequest } from "fastify";

function normalizeIp(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("::ffff:")) {
    return trimmed.slice("::ffff:".length);
  }
  return trimmed;
}

export function getRealIP(request: FastifyRequest): string {
  // Primary: Use Fastify's request.ip which respects the trustProxy configuration.
  // This safely resolves the real client IP based on trusted proxy chain.
  if (request.ip) {
    return normalizeIp(request.ip);
  }

  // Fallback: raw socket address
  if (request.raw?.socket?.remoteAddress) {
    return normalizeIp(request.raw.socket.remoteAddress);
  }

  return "unknown";
}
