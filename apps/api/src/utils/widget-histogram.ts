/**
 * widget-histogram.ts — Rolling histogram for widget response times.
 *
 * Buckets (ms): 0-50, 50-100, 100-200, 200-500, 500-1000, 1000-2000, 2000+
 * Stored as JSON on Organization.widgetRtBucketsJson
 *
 * p50/p95 computed at read time from the histogram.
 */

export interface HistogramBucket {
  max: number;   // upper bound in ms (Infinity represented as 999999)
  count: number;
}

/** Fixed bucket boundaries in ms */
const BUCKET_BOUNDS = [50, 100, 200, 500, 1000, 2000, 999999];

/** Create an empty histogram */
export function emptyHistogram(): HistogramBucket[] {
  return BUCKET_BOUNDS.map((max) => ({ max, count: 0 }));
}

/** Parse stored JSON into histogram, with fallback to empty */
export function parseHistogram(json: unknown): HistogramBucket[] {
  if (!json || typeof json !== "object") return emptyHistogram();
  const obj = json as Record<string, unknown>;
  const buckets = obj.buckets;
  if (!Array.isArray(buckets) || buckets.length !== BUCKET_BOUNDS.length) {
    return emptyHistogram();
  }
  return buckets.map((b: unknown, i: number) => ({
    max: BUCKET_BOUNDS[i],
    count: typeof (b as HistogramBucket)?.count === "number" ? (b as HistogramBucket).count : 0,
  }));
}

/** Serialize histogram for DB storage */
export function serializeHistogram(buckets: HistogramBucket[]): { buckets: HistogramBucket[] } {
  return { buckets };
}

/** Find which bucket a duration falls into and return the index */
export function bucketIndex(durationMs: number): number {
  for (let i = 0; i < BUCKET_BOUNDS.length; i++) {
    if (durationMs <= BUCKET_BOUNDS[i]) return i;
  }
  return BUCKET_BOUNDS.length - 1;
}

/**
 * Compute a percentile from the histogram.
 *
 * @param buckets  The histogram buckets
 * @param totalCount Total number of samples
 * @param percentile 0-100 (e.g. 50 for p50, 95 for p95)
 * @returns Estimated value in ms, or null if no data
 */
export function computePercentile(
  buckets: HistogramBucket[],
  totalCount: number,
  percentile: number
): number | null {
  if (totalCount === 0) return null;

  const targetCount = Math.ceil((percentile / 100) * totalCount);
  let cumulative = 0;

  // Bucket lower bounds
  const lowerBounds = [0, 50, 100, 200, 500, 1000, 2000];

  for (let i = 0; i < buckets.length; i++) {
    cumulative += buckets[i].count;
    if (cumulative >= targetCount) {
      // Linear interpolation within bucket
      const lo = lowerBounds[i];
      const hi = buckets[i].max === 999999 ? 5000 : buckets[i].max; // cap display
      const bucketStart = cumulative - buckets[i].count;
      const posInBucket = targetCount - bucketStart;
      const fraction = buckets[i].count > 0 ? posInBucket / buckets[i].count : 0.5;
      return Math.round(lo + fraction * (hi - lo));
    }
  }

  return null;
}

/**
 * Build the SQL to atomically increment a histogram bucket and totalCount.
 *
 * Uses JSONB manipulation to update a single bucket count in-place.
 * Returns SQL + bound params for $executeRawUnsafe using placeholders ($1/$2).
 */
export function buildHistogramUpdateSql(
  orgId: string,
  durationMs: number
): { sql: string; params: [string, number] } {
  const idx = bucketIndex(durationMs);
  // Atomically increment the specific bucket count using jsonb_set
  // and also increment widgetRtTotalCount
  const sql = `
    UPDATE "organizations"
    SET
      "widgetRtBucketsJson" = CASE
        WHEN "widgetRtBucketsJson" IS NULL THEN $2::jsonb
        ELSE jsonb_set(
          "widgetRtBucketsJson",
          '{buckets,${idx},count}',
          (COALESCE(("widgetRtBucketsJson"->'buckets'->${idx}->>'count')::int, 0) + 1)::text::jsonb
        )
      END,
      "widgetRtTotalCount" = "widgetRtTotalCount" + 1
    WHERE "id" = $1
  `;
  // When NULL, initialize with a fresh histogram that has 1 in the target bucket
  const fresh = emptyHistogram();
  fresh[idx].count = 1;
  return {
    sql,
    params: [orgId, JSON.stringify(serializeHistogram(fresh)) as unknown as number],
  };
}
