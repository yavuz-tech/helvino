/**
 * Simple in-memory metrics tracking
 * 
 * Tracks rolling 60-second window counters for observability.
 * No external dependencies, fast and minimal.
 */

interface MetricsSnapshot {
  // Request counters (last 60s)
  req_total: number;
  req_2xx: number;
  req_4xx: number;
  req_5xx: number;
  rate_limited_429: number;

  // Latency stats (last 60s)
  avg_latency_ms: number;
  p95_latency_ms: number;

  // Endpoint-specific counters (last 60s)
  bootloader_calls: number;
  conversations_posts: number;
  messages_posts: number;

  // Window info
  window_seconds: number;
  timestamp: string;
}

interface DataPoint {
  timestamp: number;
  statusCode: number;
  latencyMs: number;
  route: string;
}

class MetricsTracker {
  private dataPoints: DataPoint[] = [];
  private readonly windowMs = 60000; // 60 seconds

  /**
   * Record a request
   */
  recordRequest(statusCode: number, latencyMs: number, route: string): void {
    const now = Date.now();
    this.dataPoints.push({
      timestamp: now,
      statusCode,
      latencyMs,
      route,
    });

    // Clean old data points outside the window
    this.cleanup(now);
  }

  /**
   * Get current metrics snapshot
   */
  getSnapshot(): MetricsSnapshot {
    const now = Date.now();
    this.cleanup(now);

    const recentPoints = this.dataPoints;

    // Count by status code ranges
    let req_2xx = 0;
    let req_4xx = 0;
    let req_5xx = 0;
    let rate_limited_429 = 0;

    // Endpoint-specific counters
    let bootloader_calls = 0;
    let conversations_posts = 0;
    let messages_posts = 0;

    // Latency tracking
    const latencies: number[] = [];

    for (const point of recentPoints) {
      const code = point.statusCode;

      // Status code ranges
      if (code >= 200 && code < 300) req_2xx++;
      else if (code >= 400 && code < 500) req_4xx++;
      else if (code >= 500) req_5xx++;

      if (code === 429) rate_limited_429++;

      // Endpoint-specific
      if (point.route.includes("/api/bootloader")) bootloader_calls++;
      if (point.route === "/conversations" && code >= 200 && code < 300) conversations_posts++;
      if (point.route.includes("/conversations/") && point.route.includes("/messages") && code >= 200 && code < 300) {
        messages_posts++;
      }

      // Latency
      latencies.push(point.latencyMs);
    }

    const req_total = recentPoints.length;

    // Calculate latency stats
    let avg_latency_ms = 0;
    let p95_latency_ms = 0;

    if (latencies.length > 0) {
      const sum = latencies.reduce((acc, val) => acc + (val || 0), 0);
      avg_latency_ms = sum / latencies.length;
      p95_latency_ms = this.calculateP95(latencies);
    }

    return {
      req_total,
      req_2xx,
      req_4xx,
      req_5xx,
      rate_limited_429,
      avg_latency_ms: Math.round(avg_latency_ms * 100) / 100,
      p95_latency_ms: Math.round(p95_latency_ms * 100) / 100,
      bootloader_calls,
      conversations_posts,
      messages_posts,
      window_seconds: 60,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Calculate P95 latency
   */
  private calculateP95(latencies: number[]): number {
    if (latencies.length === 0) return 0;

    const sorted = [...latencies].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Remove data points older than the window
   */
  private cleanup(now: number): void {
    const cutoff = now - this.windowMs;
    this.dataPoints = this.dataPoints.filter((point) => point.timestamp >= cutoff);
  }

  /**
   * Reset all metrics (for testing)
   */
  reset(): void {
    this.dataPoints = [];
  }
}

// Singleton instance
export const metricsTracker = new MetricsTracker();
