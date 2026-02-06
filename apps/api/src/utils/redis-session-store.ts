/**
 * Redis Session Store for @fastify/session
 *
 * Persists sessions in Redis so they survive API restarts.
 * Compatible with the SessionStore interface expected by @fastify/session.
 */

import { redis } from "../redis";

const PREFIX = "sess:";
const DEFAULT_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

interface SessionData {
  [key: string]: unknown;
}

type StoreCallback = (err?: Error | null, session?: SessionData | null) => void;
type VoidCallback = (err?: Error | null) => void;

export class RedisSessionStore {
  private ttl: number;

  constructor(ttl?: number) {
    this.ttl = ttl ?? DEFAULT_TTL;
  }

  set(sessionId: string, session: SessionData, callback: VoidCallback): void {
    const key = PREFIX + sessionId;
    const data = JSON.stringify(session);
    redis
      .setex(key, this.ttl, data)
      .then(() => callback(null))
      .catch((err) => callback(err));
  }

  get(sessionId: string, callback: StoreCallback): void {
    const key = PREFIX + sessionId;
    redis
      .get(key)
      .then((data) => {
        if (!data) return callback(null, null);
        try {
          callback(null, JSON.parse(data));
        } catch {
          callback(null, null);
        }
      })
      .catch((err) => callback(err));
  }

  destroy(sessionId: string, callback: VoidCallback): void {
    const key = PREFIX + sessionId;
    redis
      .del(key)
      .then(() => callback(null))
      .catch((err) => callback(err));
  }
}
