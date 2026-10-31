import { getAdminClient } from '@/lib/supabase/admin';

export interface RateLimitOptions {
  failClosed?: boolean;
  endpoint?: string;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetMs: number;
  error?: string;
}

export interface RateLimitStore {
  checkRateLimit(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetSeconds: number }>;
}

/**
 * Extracts a sanitized client IP from incoming request headers.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const firstIp = forwarded.split(',')[0].trim();
    if (firstIp) return firstIp;
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp && realIp.trim()) {
    return realIp.trim();
  }
  return '127.0.0.1';
}

/**
 * Default PostgreSQL store for distributed rate limiting across Vercel serverless instances.
 */
export class SupabaseRateLimitStore implements RateLimitStore {
  async checkRateLimit(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetSeconds: number }> {
    const adminClient = getAdminClient();
    if (!adminClient) {
      throw new Error('Supabase admin client unavailable for rate limiting.');
    }

    // 1. Try atomic PostgreSQL RPC function (row-level lock on key)
    try {
      const { data, error } = await adminClient.rpc('check_rate_limit', {
        p_key: key,
        p_limit: limit,
        p_window_seconds: windowSeconds,
      });

      if (!error && data) {
        const result = Array.isArray(data) ? data[0] : data;
        if (result && typeof result.allowed !== 'undefined') {
          return {
            allowed: Boolean(result.allowed),
            remaining: Number(result.remaining ?? 0),
            resetSeconds: Number(result.reset_seconds ?? windowSeconds),
          };
        }
      }
    } catch {
      // Fall through to direct table fallback
    }

    // 2. Direct table fallback if RPC is not deployed yet or schema cache is refreshing
    const now = new Date();
    const expiresAt = new Date(now.getTime() + windowSeconds * 1000);

    const { data: record, error: selectError } = await adminClient
      .from('rate_limits')
      .select('*')
      .eq('key', key)
      .maybeSingle();

    if (selectError) {
      throw selectError;
    }

    if (!record || new Date(record.expires_at) <= now) {
      // Window is fresh or expired: reset
      const { error: upsertError } = await adminClient.from('rate_limits').upsert({
        key,
        count: 1,
        window_start: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        updated_at: now.toISOString(),
      });
      if (upsertError) throw upsertError;

      return {
        allowed: true,
        remaining: limit - 1,
        resetSeconds: windowSeconds,
      };
    }

    const currentCount = Number(record.count || 0);
    const recordExpiresAt = new Date(record.expires_at);
    const resetSeconds = Math.max(1, Math.ceil((recordExpiresAt.getTime() - now.getTime()) / 1000));

    if (currentCount >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetSeconds,
      };
    }

    const { error: updateError } = await adminClient
      .from('rate_limits')
      .update({
        count: currentCount + 1,
        updated_at: now.toISOString(),
      })
      .eq('key', key);

    if (updateError) throw updateError;

    return {
      allowed: true,
      remaining: limit - (currentCount + 1),
      resetSeconds,
    };
  }
}

/**
 * In-memory shared store for testing distributed multi-instance simulation.
 */
export class MemorySharedRateLimitStore implements RateLimitStore {
  private records = new Map<string, { count: number; windowStart: number; expiresAt: number }>();

  async checkRateLimit(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetSeconds: number }> {
    const now = Date.now();
    const existing = this.records.get(key);

    if (!existing || existing.expiresAt <= now) {
      const expiresAt = now + windowSeconds * 1000;
      this.records.set(key, { count: 1, windowStart: now, expiresAt });
      return {
        allowed: true,
        remaining: limit - 1,
        resetSeconds: windowSeconds,
      };
    }

    const resetSeconds = Math.max(1, Math.ceil((existing.expiresAt - now) / 1000));

    if (existing.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetSeconds,
      };
    }

    existing.count += 1;
    return {
      allowed: true,
      remaining: limit - existing.count,
      resetSeconds,
    };
  }

  clear() {
    this.records.clear();
  }
}

let activeStore: RateLimitStore = new SupabaseRateLimitStore();

/**
 * Configure active rate limiting store (e.g. for testing distributed multi-instance scenarios).
 */
export function setRateLimitStore(store: RateLimitStore | null) {
  activeStore = store || new SupabaseRateLimitStore();
}

/**
 * Gets currently active store.
 */
export function getRateLimitStore(): RateLimitStore {
  return activeStore;
}

/**
 * Distributed rate limiter.
 * Operates across all Vercel serverless functions by persisting counters in Supabase PostgreSQL.
 *
 * @param key Unique key for client/endpoint (e.g. `admin-login:${ip}` or `contact:${ip}`)
 * @param limit Maximum allowed requests in the time window
 * @param windowMs Time window in milliseconds (default: 60,000 ms = 1 minute)
 * @param options Fail-closed/open policy and optional endpoint context
 */
export async function checkRateLimit(
  key: string,
  limit: number = 30,
  windowMs: number = 60000,
  options: RateLimitOptions = {}
): Promise<RateLimitResult> {
  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
  const failClosed = options.failClosed ?? false;

  try {
    const res = await activeStore.checkRateLimit(key, limit, windowSeconds);
    return {
      success: res.allowed,
      remaining: res.remaining,
      resetMs: res.resetSeconds * 1000,
    };
  } catch (err: any) {
    console.error(
      `[Distributed Rate Limit Error] Failed checking key "${key}" for endpoint "${options.endpoint || 'unknown'}":`,
      err?.message || err
    );

    if (failClosed) {
      // Sensitive endpoints fail closed to prevent brute force attacks during database degradation
      return {
        success: false,
        remaining: 0,
        resetMs: Math.min(windowMs, 60000),
        error: 'Rate limiter unavailable (fail-closed protection enforced)',
      };
    }

    // Non-sensitive public endpoints fail open to maintain service availability
    return {
      success: true,
      remaining: 1,
      resetMs: Math.min(windowMs, 60000),
      error: 'Rate limiter unavailable (fail-open availability policy)',
    };
  }
}
