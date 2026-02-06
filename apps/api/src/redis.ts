/**
 * Redis Client Singleton
 * 
 * Shared Redis client for rate limiting and health checks
 */

import Redis from "ioredis";

// Redis client configuration
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  lazyConnect: true,
});

// Connect to Redis and handle errors
redis.connect().catch((err) => {
  console.error("❌ Redis connection failed:", err.message);
  console.warn("⚠️  Rate limiting will be disabled until Redis is available");
});

redis.on("error", (err) => {
  console.error("❌ Redis error:", err.message);
});

redis.on("connect", () => {
  console.log("✅ Redis connected");
});
