import { FastifyReply, FastifyRequest } from "fastify";
import { getRealIP } from "../utils/get-real-ip";

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
  keyPrefix?: string;
  keyBuilder?: (request: FastifyRequest) => string;
  includeEndpointInKey?: boolean;
}

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();
const DEV_MULTIPLIER = 10;

function getEffectiveMax(maxRequests: number): number {
  if (process.env.NODE_ENV === "production") return maxRequests;
  return Math.max(1, maxRequests * DEV_MULTIPLIER);
}

function pruneTimestamps(timestamps: number[], cutoff: number): number[] {
  let index = 0;
  while (index < timestamps.length && timestamps[index] <= cutoff) {
    index += 1;
  }
  return index > 0 ? timestamps.slice(index) : timestamps;
}

function buildIdentity(request: FastifyRequest, keyBuilder?: (request: FastifyRequest) => string): string {
  if (keyBuilder) {
    const custom = keyBuilder(request);
    if (custom) return custom;
  }
  return getRealIP(request) || "unknown-ip";
}

function buildEndpointKey(request: FastifyRequest, keyPrefix?: string): string {
  if (keyPrefix) return keyPrefix;
  const routePattern = request.routeOptions?.url || request.url.split("?")[0] || "unknown-route";
  return `${request.method}:${routePattern}`;
}

function cleanupBucketStore(now: number): void {
  if (buckets.size <= 5000) return;
  for (const [key, bucket] of buckets.entries()) {
    const fresh = pruneTimestamps(bucket.timestamps, now - 24 * 60 * 60 * 1000);
    if (fresh.length === 0) {
      buckets.delete(key);
    } else if (fresh.length !== bucket.timestamps.length) {
      buckets.set(key, { timestamps: fresh });
    }
  }
}

export function rateLimit(config: RateLimitConfig) {
  const baseMessage = config.message || "Too many requests, please try again later.";
  const includeEndpoint = config.includeEndpointInKey !== false;

  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.method === "OPTIONS") return;
    if ((request.url || "").startsWith("/socket.io")) return;

    const now = Date.now();
    const effectiveMax = getEffectiveMax(config.maxRequests);
    const endpointKey = buildEndpointKey(request, config.keyPrefix);
    const identity = buildIdentity(request, config.keyBuilder);
    const bucketKey = includeEndpoint ? `${endpointKey}:${identity}` : `${config.keyPrefix || "global"}:${identity}`;
    const cutoff = now - config.windowMs;

    const currentBucket = buckets.get(bucketKey);
    const timestamps = pruneTimestamps(currentBucket?.timestamps || [], cutoff);
    const currentCount = timestamps.length;
    const isBlocked = currentCount >= effectiveMax;

    let resetAtMs = now + config.windowMs;
    if (timestamps.length > 0) {
      resetAtMs = timestamps[0] + config.windowMs;
    }

    if (!isBlocked) {
      timestamps.push(now);
      buckets.set(bucketKey, { timestamps });
      resetAtMs = timestamps[0] + config.windowMs;
    } else {
      buckets.set(bucketKey, { timestamps });
    }

    const remaining = isBlocked ? 0 : Math.max(0, effectiveMax - timestamps.length);
    const resetUnix = Math.ceil(resetAtMs / 1000);
    reply.header("X-RateLimit-Limit", String(effectiveMax));
    reply.header("X-RateLimit-Remaining", String(remaining));
    reply.header("X-RateLimit-Reset", String(resetUnix));

    cleanupBucketStore(now);

    if (!isBlocked) return;

    const retryAfterSec = Math.max(1, Math.ceil((resetAtMs - now) / 1000));
    reply.header("Retry-After", String(retryAfterSec));
    reply.code(429);
    return reply.send({
      error: {
        code: "RATE_LIMITED",
        message: baseMessage,
        retryAfterSec,
      },
    });
  };
}
