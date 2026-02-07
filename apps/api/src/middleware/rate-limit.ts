/**
 * Rate Limiting Middleware — v11.29
 * 
 * Redis-based implementation with per-org-key + per-IP keying
 * Supports distributed rate limiting across multiple API instances
 *
 * Features:
 * - Consistent 429 error envelope with { error: { code: "RATE_LIMITED", message, retryAfterSec, requestId } }
 * - Retry-After header (seconds)
 * - Dev multiplier (RATE_LIMIT_DEV_MULTIPLIER env)
 * - Optional audit logging for rate-limited events
 * - x-request-id propagation
 */

import { FastifyRequest, FastifyReply } from "fastify";
import { redis } from "../redis";
import { writeAuditLog } from "../utils/audit-log";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  // If Redis is not connected, allow the request (fail open)
  if (redis.status !== "ready") {
    console.warn(`⚠️  Redis not ready, allowing request for key: ${key}`);
    return { allowed: true, remaining: limit - 1, resetAt: Date.now() + windowMs };
  }

  try {
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs);
    const redisKey = `ratelimit:${key}:${windowStart}`;
    const ttlSeconds = Math.ceil(windowMs / 1000);

    // Increment the counter
    const count = await redis.incr(redisKey);

    // Set expiration on first request in this window
    if (count === 1) {
      await redis.expire(redisKey, ttlSeconds);
    }

    const resetAt = (windowStart + 1) * windowMs;
    const remaining = Math.max(0, limit - count);
    const allowed = count <= limit;

    return { allowed, remaining, resetAt };
  } catch (error) {
    console.error("❌ Rate limit check failed:", error);
    // Fail open: allow the request if Redis fails
    return { allowed: true, remaining: limit - 1, resetAt: Date.now() + windowMs };
  }
}

export interface RateLimitConfig {
  limit: number;      // Max requests
  windowMs: number;   // Time window in milliseconds
  /** Optional custom key builder. If not provided, uses orgKey:ip */
  keyBuilder?: (request: FastifyRequest) => string;
  /** If true, audit log the rate-limited event (default: true) */
  auditLog?: boolean;
  /** Route name for audit log context */
  routeName?: string;
}

/** Dev multiplier from environment */
function getDevMultiplier(): number {
  if (process.env.NODE_ENV === "production") return 1;
  const m = parseInt(process.env.RATE_LIMIT_DEV_MULTIPLIER || "3", 10);
  return isNaN(m) || m < 1 ? 3 : m;
}

/**
 * Rate limit middleware factory
 * Combines org key + IP for keying (or custom key builder)
 */
export function createRateLimitMiddleware(config: RateLimitConfig) {
  const shouldAudit = config.auditLog !== false;

  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip rate limiting for authenticated internal admin session or internal key
    const internalKey = request.headers["x-internal-key"] as string | undefined;
    const adminUserId = request.session?.adminUserId;
    if (internalKey || adminUserId) {
      return;
    }

    // Build the rate limit key
    let rateLimitKey: string;
    if (config.keyBuilder) {
      rateLimitKey = config.keyBuilder(request);
    } else {
      const orgKey = request.headers["x-org-key"] as string || "anonymous";
      const ip = request.ip;
      rateLimitKey = `${orgKey}:${ip}`;
    }

    const multiplier = getDevMultiplier();
    const effectiveLimit = config.limit * multiplier;
    const result = await checkRateLimit(rateLimitKey, effectiveLimit, config.windowMs);

    // Add rate limit headers
    reply.header("X-RateLimit-Limit", effectiveLimit);
    reply.header("X-RateLimit-Remaining", result.remaining);
    reply.header("X-RateLimit-Reset", new Date(result.resetAt).toISOString());

    if (!result.allowed) {
      const retryAfterSec = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
      reply.header("Retry-After", retryAfterSec);

      // Audit log the rate-limited event (best-effort)
      if (shouldAudit) {
        const route = config.routeName || request.routeOptions?.url || request.url;
        const orgId = (request as any).portalUser?.orgId
          || request.session?.orgId
          || "unknown";
        const actor = (request as any).portalUser?.email
          || request.session?.adminEmail
          || request.ip
          || "anonymous";
        writeAuditLog(
          orgId,
          actor,
          "security.rate_limited",
          { route, key: rateLimitKey, retryAfterSec, ip: request.ip },
          request.requestId
        ).catch(() => { /* best-effort */ });
      }

      const requestId = request.requestId || undefined;
      reply.code(429);
      return reply.send({
        error: {
          code: "RATE_LIMITED",
          message: `Too many requests. Please try again in ${retryAfterSec} seconds.`,
          retryAfterSec,
          requestId,
        },
      });
    }
  };
}

// Cleanup on process exit
process.on("SIGTERM", () => redis.quit());
process.on("SIGINT", () => redis.quit());
