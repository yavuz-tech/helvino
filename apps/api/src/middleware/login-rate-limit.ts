import { FastifyReply, FastifyRequest } from "fastify";
import { redis } from "../redis";
import { getRealIP } from "../utils/get-real-ip";

const isProduction = process.env.NODE_ENV === "production";
const WINDOW_MS = isProduction ? 15 * 60 * 1000 : 60 * 1000; // prod: 15m, dev: 1m
const MAX_ATTEMPTS = isProduction ? 5 : 30; // prod: strict, dev: relaxed

const attemptsByIp = new Map<string, { count: number; resetAt: number }>();

function cleanupBuckets(now: number) {
  if (attemptsByIp.size < 5000) return;
  for (const [ip, bucket] of attemptsByIp.entries()) {
    if (bucket.resetAt <= now) {
      attemptsByIp.delete(ip);
    }
  }
}

export async function loginRateLimitMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const now = Date.now();
  const ip = getRealIP(request);
  let count = 0;
  let resetAt = now + WINDOW_MS;

  if (redis.status === "ready") {
    const windowStart = Math.floor(now / WINDOW_MS);
    const key = `login-rate-limit:${ip}:${windowStart}`;
    resetAt = (windowStart + 1) * WINDOW_MS;
    count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, Math.ceil(WINDOW_MS / 1000));
    }
  } else {
    const existing = attemptsByIp.get(ip);
    if (!existing || existing.resetAt <= now) {
      attemptsByIp.set(ip, { count: 1, resetAt: now + WINDOW_MS });
      cleanupBuckets(now);
      count = 1;
      resetAt = now + WINDOW_MS;
    } else {
      existing.count += 1;
      attemptsByIp.set(ip, existing);
      count = existing.count;
      resetAt = existing.resetAt;
    }
  }

  if (count > MAX_ATTEMPTS) {
    const retryAfterSec = Math.max(1, Math.ceil((resetAt - now) / 1000));
    reply.header("Retry-After", retryAfterSec);
    reply.code(429);
    return reply.send({
      error: {
        code: "TOO_MANY_ATTEMPTS",
        message: "Too many attempts",
        retryAfterSec,
      },
    });
  }
}

