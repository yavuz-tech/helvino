import { FastifyReply, FastifyRequest } from "fastify";
import { redis } from "../redis";
import { getRealIP } from "../utils/get-real-ip";

const isProduction = process.env.NODE_ENV === "production";
const WINDOW_MS = isProduction ? 30 * 60 * 1000 : 60 * 1000;
const IP_LIMIT = isProduction ? 3 : 30;
const LOCKOUT_MS = isProduction ? 30 * 60 * 1000 : 5 * 60 * 1000;
const LOCKOUT_AFTER_FAILED = isProduction ? 3 : 10;
const CAPTCHA_AFTER_FAILED = isProduction ? 2 : 5;
const KEY_PREFIX = "admin:login:v2";

const ipBuckets = new Map<string, { count: number; resetAt: number }>();
const failedByEmail = new Map<string, { count: number; resetAt: number }>();
const lockByEmail = new Map<string, number>();

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

function getNow() {
  return Date.now();
}

function cleanupMemory(now: number) {
  if (ipBuckets.size > 5000) {
    for (const [key, item] of ipBuckets.entries()) {
      if (item.resetAt <= now) ipBuckets.delete(key);
    }
  }
  if (failedByEmail.size > 5000) {
    for (const [key, item] of failedByEmail.entries()) {
      if (item.resetAt <= now) failedByEmail.delete(key);
    }
  }
  if (lockByEmail.size > 5000) {
    for (const [key, until] of lockByEmail.entries()) {
      if (until <= now) lockByEmail.delete(key);
    }
  }
}

function ipKey(ip: string, windowStart: number) {
  return `${KEY_PREFIX}:ip:${ip}:${windowStart}`;
}

function failedKey(email: string, windowStart: number) {
  return `${KEY_PREFIX}:failed:${email}:${windowStart}`;
}

function lockKey(email: string) {
  return `${KEY_PREFIX}:lock:${email}`;
}

export interface AdminLockState {
  locked: boolean;
  retryAfterSec: number;
}

export async function getAdminAccountLockState(email: string): Promise<AdminLockState> {
  const normalized = normalizeEmail(email);
  if (!normalized) return { locked: false, retryAfterSec: 0 };
  const now = getNow();

  if (redis.status === "ready") {
    const ttl = await redis.ttl(lockKey(normalized));
    if (ttl > 0) {
      return { locked: true, retryAfterSec: ttl };
    }
    return { locked: false, retryAfterSec: 0 };
  }

  cleanupMemory(now);
  const lockedUntil = lockByEmail.get(normalized);
  if (!lockedUntil || lockedUntil <= now) {
    return { locked: false, retryAfterSec: 0 };
  }
  return { locked: true, retryAfterSec: Math.max(1, Math.ceil((lockedUntil - now) / 1000)) };
}

async function getFailedAttempts(email: string): Promise<number> {
  const normalized = normalizeEmail(email);
  if (!normalized) return 0;
  const now = getNow();

  if (redis.status === "ready") {
    const windowStart = Math.floor(now / WINDOW_MS);
    const count = await redis.get(failedKey(normalized, windowStart));
    return count ? parseInt(count, 10) || 0 : 0;
  }

  cleanupMemory(now);
  const bucket = failedByEmail.get(normalized);
  if (!bucket || bucket.resetAt <= now) return 0;
  return bucket.count;
}

export async function isAdminCaptchaRequired(email: string): Promise<boolean> {
  const failed = await getFailedAttempts(email);
  return failed >= CAPTCHA_AFTER_FAILED;
}

export async function recordFailedAdminLogin(email: string): Promise<{
  failedAttempts: number;
  locked: boolean;
  retryAfterSec: number;
}> {
  const normalized = normalizeEmail(email);
  if (!normalized) return { failedAttempts: 0, locked: false, retryAfterSec: 0 };
  const now = getNow();

  if (redis.status === "ready") {
    const windowStart = Math.floor(now / WINDOW_MS);
    const failedCounterKey = failedKey(normalized, windowStart);
    const count = await redis.incr(failedCounterKey);
    if (count === 1) {
      await redis.pexpire(failedCounterKey, WINDOW_MS);
    }
    if (count >= LOCKOUT_AFTER_FAILED) {
      const lk = lockKey(normalized);
      await redis.set(lk, "1", "PX", LOCKOUT_MS);
      return {
        failedAttempts: count,
        locked: true,
        retryAfterSec: Math.ceil(LOCKOUT_MS / 1000),
      };
    }
    return { failedAttempts: count, locked: false, retryAfterSec: 0 };
  }

  cleanupMemory(now);
  const existing = failedByEmail.get(normalized);
  const resetAt = existing && existing.resetAt > now ? existing.resetAt : now + WINDOW_MS;
  const nextCount = (existing && existing.resetAt > now ? existing.count : 0) + 1;
  failedByEmail.set(normalized, { count: nextCount, resetAt });

  if (nextCount >= LOCKOUT_AFTER_FAILED) {
    const lockedUntil = now + LOCKOUT_MS;
    lockByEmail.set(normalized, lockedUntil);
    return {
      failedAttempts: nextCount,
      locked: true,
      retryAfterSec: Math.ceil(LOCKOUT_MS / 1000),
    };
  }
  return { failedAttempts: nextCount, locked: false, retryAfterSec: 0 };
}

export async function clearFailedAdminLogin(email: string): Promise<void> {
  const normalized = normalizeEmail(email);
  if (!normalized) return;
  const now = getNow();

  if (redis.status === "ready") {
    const windowStart = Math.floor(now / WINDOW_MS);
    await redis.del(failedKey(normalized, windowStart), lockKey(normalized));
    return;
  }

  failedByEmail.delete(normalized);
  lockByEmail.delete(normalized);
}

export async function adminRateLimitMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const now = getNow();
  const ip = getRealIP(request);

  if (redis.status === "ready") {
    const windowStart = Math.floor(now / WINDOW_MS);
    const key = ipKey(ip, windowStart);
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.pexpire(key, WINDOW_MS);
    }
    if (count > IP_LIMIT) {
      const retryAfterSec = Math.ceil(WINDOW_MS / 1000);
      reply.header("Retry-After", retryAfterSec);
      reply.code(429);
      return reply.send({
        error: {
          code: "RATE_LIMITED",
          message: `Too many attempts. Try again in ${retryAfterSec} seconds.`,
          retryAfterSec,
        },
      });
    }
    return;
  }

  cleanupMemory(now);
  const bucket = ipBuckets.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    ipBuckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  bucket.count += 1;
  ipBuckets.set(ip, bucket);

  if (bucket.count > IP_LIMIT) {
    const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    reply.header("Retry-After", retryAfterSec);
    reply.code(429);
    return reply.send({
      error: {
        code: "RATE_LIMITED",
        message: `Too many attempts. Try again in ${retryAfterSec} seconds.`,
        retryAfterSec,
      },
    });
  }
}
