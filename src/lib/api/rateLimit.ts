interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitMap = new Map<string, RateLimitRecord>();

// Periodically clean up entries older than windowMs
const CLEANUP_INTERVAL_MS = 60000;
let lastCleanup = Date.now();

function cleanupStaleEntries(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  const threshold = now - windowMs;
  for (const [key, record] of rateLimitMap.entries()) {
    record.timestamps = record.timestamps.filter((ts) => ts > threshold);
    if (record.timestamps.length === 0) {
      rateLimitMap.delete(key);
    }
  }
}

/**
 * In-memory sliding window rate limiter.
 * @param key Unique key for client/endpoint (e.g. `ip:contact` or `userId:upload`)
 * @param limit Maximum allowed requests in the time window
 * @param windowMs Time window in milliseconds (default: 60 seconds)
 * @returns { success: boolean, remaining: number, resetMs: number }
 */
export function checkRateLimit(
  key: string,
  limit: number = 30,
  windowMs: number = 60000
): { success: boolean; remaining: number; resetMs: number } {
  cleanupStaleEntries(windowMs);

  const now = Date.now();
  const threshold = now - windowMs;

  let record = rateLimitMap.get(key);
  if (!record) {
    record = { timestamps: [] };
    rateLimitMap.set(key, record);
  }

  // Filter timestamps within current window
  record.timestamps = record.timestamps.filter((ts) => ts > threshold);

  if (record.timestamps.length >= limit) {
    const oldest = record.timestamps[0];
    const resetMs = Math.max(0, oldest + windowMs - now);
    return {
      success: false,
      remaining: 0,
      resetMs,
    };
  }

  record.timestamps.push(now);

  return {
    success: true,
    remaining: limit - record.timestamps.length,
    resetMs: windowMs,
  };
}
