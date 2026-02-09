/**
 * Host Trust Enforcement — Step 11.28
 *
 * Rejects requests with an untrusted Host header to prevent
 * host header injection / cache poisoning / password reset poisoning.
 *
 * Config:
 *   TRUSTED_HOSTS  — comma-separated list of trusted host values
 *   APP_PUBLIC_URL — canonical public URL (its host is auto-trusted)
 *
 * In development (NODE_ENV !== production):
 *   localhost, localhost:PORT, and 127.0.0.1:PORT are auto-trusted.
 *
 * Returns 400 if Host is not trusted.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";

let trustedHostsSet: Set<string> | null = null;

function buildTrustedHosts(): Set<string> {
  if (trustedHostsSet) return trustedHostsSet;

  const hosts = new Set<string>();
  const isProduction = process.env.NODE_ENV === "production";

  // 1. From TRUSTED_HOSTS env
  const envHosts = process.env.TRUSTED_HOSTS;
  if (envHosts) {
    envHosts.split(",").forEach((h) => {
      const trimmed = h.trim().toLowerCase();
      if (trimmed) hosts.add(trimmed);
    });
  }

  // 2. From APP_PUBLIC_URL / NEXT_PUBLIC_WEB_URL (extract host)
  const publicUrl = process.env.APP_PUBLIC_URL || process.env.NEXT_PUBLIC_WEB_URL;
  if (publicUrl) {
    try {
      const url = new URL(publicUrl);
      hosts.add(url.host.toLowerCase());
    } catch { /* invalid URL, skip */ }
  }

  // 3. Dev defaults: always trust localhost variants
  if (!isProduction) {
    const port = process.env.PORT || "4000";
    hosts.add("localhost");
    hosts.add(`localhost:${port}`);
    hosts.add(`localhost:3000`);
    hosts.add(`localhost:4000`);
    hosts.add("127.0.0.1");
    hosts.add(`127.0.0.1:${port}`);
    hosts.add(`127.0.0.1:3000`);
    hosts.add(`127.0.0.1:4000`);
    hosts.add("0.0.0.0");
    hosts.add(`0.0.0.0:${port}`);
  }

  trustedHostsSet = hosts;
  return hosts;
}

/**
 * Check if a request's Host header is trusted.
 */
export function isHostTrusted(host: string | undefined): boolean {
  if (!host) return false;
  const isProduction = process.env.NODE_ENV === "production";
  const trusted = buildTrustedHosts();
  // Empty trusted set: allow all in dev, reject in production
  if (trusted.size === 0) return !isProduction;
  return trusted.has(host.toLowerCase());
}

/**
 * Get the canonical public URL (for link generation, redirects).
 */
export function getCanonicalUrl(): string {
  return process.env.APP_PUBLIC_URL || process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000";
}

/**
 * Fastify plugin: host trust enforcement.
 * Registered as onRequest hook — runs before any route handler.
 * Wrapped with fastify-plugin to apply globally (break encapsulation).
 */
export const hostTrustPlugin = fp(
  async function hostTrustPluginImpl(fastify: FastifyInstance) {
    fastify.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
      const host = request.hostname || (request.headers.host as string);

      if (!isHostTrusted(host)) {
        const requestId = request.requestId || undefined;
        request.log.warn({ host, requestId }, "Untrusted Host header rejected");
        reply.code(400).send({
          error: { code: "UNTRUSTED_HOST", message: "Untrusted Host header", requestId },
        });
      }
    });
  },
  { name: "host-trust" }
);

/**
 * Reset cached hosts (for testing).
 */
export function resetTrustedHosts() {
  trustedHostsSet = null;
}
