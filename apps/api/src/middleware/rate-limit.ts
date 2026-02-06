/**
 * Rate Limiting Middleware
 * 
 * Redis-based implementation with per-org-key + per-IP keying
 * Supports distributed rate limiting across multiple API instances
 */

import { FastifyRequest, FastifyReply } from "fastify";
import { redis } from "../redis";

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
}

/**
 * Rate limit middleware factory
 * Combines org key + IP for keying
 */
export function createRateLimitMiddleware(config: RateLimitConfig) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip rate limiting for authenticated internal admin session or internal key
    const internalKey = request.headers["x-internal-key"] as string | undefined;
    const adminUserId = request.session?.adminUserId;
    if (internalKey || adminUserId) {
      return;
    }

    const orgKey = request.headers["x-org-key"] as string || "anonymous";
    const ip = request.ip;
    
    // Combine org key + IP for rate limit key
    const rateLimitKey = `${orgKey}:${ip}`;
    
    const multiplier = process.env.NODE_ENV === "production" ? 1 : 5;
    const effectiveLimit = config.limit * multiplier;
    const result = await checkRateLimit(rateLimitKey, effectiveLimit, config.windowMs);

    // Add rate limit headers
    reply.header("X-RateLimit-Limit", effectiveLimit);
    reply.header("X-RateLimit-Remaining", result.remaining);
    reply.header("X-RateLimit-Reset", new Date(result.resetAt).toISOString());

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
      reply.header("Retry-After", retryAfter);
      reply.code(429);
      return reply.send({
        error: "Rate limit exceeded",
        message: `Too many requests. Please try again in ${retryAfter} seconds.`,
        retryAfter,
      });
    }
  };
}

// Cleanup on process exit
process.on("SIGTERM", () => redis.quit());
process.on("SIGINT", () => redis.quit());
