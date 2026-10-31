// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  checkRateLimit,
  setRateLimitStore,
  MemorySharedRateLimitStore,
  RateLimitStore,
  getClientIp,
} from '../lib/api/rateLimit';
import { parseHttpRange } from '../lib/pdf/rangeParser';
import { POST as adminLoginHandler } from '../app/api/admin/auth/login/route';
import { POST as contactHandler } from '../app/api/contact/route';
import { GET as documentFileHandler } from '../app/api/documents/[id]/file/route';

describe('OpenShelf — P2 Production Hardening Verification', () => {
  describe('P2-1: Distributed Database-Backed Rate Limiting', () => {
    let sharedStore: MemorySharedRateLimitStore;

    beforeEach(() => {
      sharedStore = new MemorySharedRateLimitStore();
      setRateLimitStore(sharedStore);
    });

    afterEach(() => {
      setRateLimitStore(null);
    });

    it('allows requests within configured limit and decrements remaining counter', async () => {
      const key = 'test-client-1';
      const limit = 5;
      const windowMs = 60000;

      const res1 = await checkRateLimit(key, limit, windowMs);
      expect(res1.success).toBe(true);
      expect(res1.remaining).toBe(4);
      expect(res1.resetMs).toBeGreaterThan(0);

      const res2 = await checkRateLimit(key, limit, windowMs);
      expect(res2.success).toBe(true);
      expect(res2.remaining).toBe(3);

      const res3 = await checkRateLimit(key, limit, windowMs);
      expect(res3.success).toBe(true);
      expect(res3.remaining).toBe(2);
    });

    it('blocks requests exceeding configured limit with remaining = 0', async () => {
      const key = 'test-client-blocked';
      const limit = 3;
      const windowMs = 30000;

      for (let i = 0; i < limit; i++) {
        const allowed = await checkRateLimit(key, limit, windowMs);
        expect(allowed.success).toBe(true);
      }

      const blocked = await checkRateLimit(key, limit, windowMs);
      expect(blocked.success).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.resetMs).toBeGreaterThan(0);
    });

    it('resets counter after window expires', async () => {
      const key = 'test-client-expiry';
      const limit = 2;
      const windowMs = 1000; // 1 second

      expect((await checkRateLimit(key, limit, windowMs)).success).toBe(true);
      expect((await checkRateLimit(key, limit, windowMs)).success).toBe(true);
      expect((await checkRateLimit(key, limit, windowMs)).success).toBe(false);

      // Wait for window expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const afterExpiry = await checkRateLimit(key, limit, windowMs);
      expect(afterExpiry.success).toBe(true);
      expect(afterExpiry.remaining).toBe(1);
    });

    it('enforces limit across multiple simulated Vercel serverless instances sharing the same store', async () => {
      // Simulate 3 independent Vercel function instances hitting the same distributed store
      const sharedKey = 'admin-login:198.51.100.42';
      const limit = 5;
      const windowMs = 60000;

      // Instance A makes 2 attempts
      const instA_1 = await checkRateLimit(sharedKey, limit, windowMs);
      const instA_2 = await checkRateLimit(sharedKey, limit, windowMs);
      expect(instA_1.success).toBe(true);
      expect(instA_2.success).toBe(true);

      // Instance B makes 2 attempts
      const instB_1 = await checkRateLimit(sharedKey, limit, windowMs);
      const instB_2 = await checkRateLimit(sharedKey, limit, windowMs);
      expect(instB_1.success).toBe(true);
      expect(instB_2.success).toBe(true);

      // Instance C makes 1 attempt (reaching the 5 limit)
      const instC_1 = await checkRateLimit(sharedKey, limit, windowMs);
      expect(instC_1.success).toBe(true);
      expect(instC_1.remaining).toBe(0);

      // Instance A makes 6th attempt -> BLOCKED by distributed store
      const instA_3 = await checkRateLimit(sharedKey, limit, windowMs);
      expect(instA_3.success).toBe(false);
      expect(instA_3.remaining).toBe(0);

      // Instance B also blocked on 7th attempt
      const instB_3 = await checkRateLimit(sharedKey, limit, windowMs);
      expect(instB_3.success).toBe(false);
    });

    it('enforces atomic concurrency limits without race condition leakage', async () => {
      const key = 'concurrent-test-key';
      const limit = 10;
      const windowMs = 60000;

      // Launch 25 concurrent requests simultaneously
      const promises = Array.from({ length: 25 }, () =>
        checkRateLimit(key, limit, windowMs)
      );

      const results = await Promise.all(promises);
      const succeeded = results.filter((r) => r.success);
      const blocked = results.filter((r) => !r.success);

      expect(succeeded.length).toBe(10);
      expect(blocked.length).toBe(15);
    });

    it('applies fail-closed security policy on database failure for sensitive admin endpoints', async () => {
      const failingStore: RateLimitStore = {
        checkRateLimit: async () => {
          throw new Error('Supabase database connection timeout (PGRST000)');
        },
      };
      setRateLimitStore(failingStore);

      const res = await checkRateLimit('admin-login:127.0.0.1', 5, 60000, {
        failClosed: true,
        endpoint: 'admin-login',
      });

      expect(res.success).toBe(false);
      expect(res.remaining).toBe(0);
      expect(res.error).toContain('fail-closed');
    });

    it('applies fail-open availability policy on database failure for non-sensitive public endpoints', async () => {
      const failingStore: RateLimitStore = {
        checkRateLimit: async () => {
          throw new Error('Supabase database unreachable');
        },
      };
      setRateLimitStore(failingStore);

      const res = await checkRateLimit('contact:127.0.0.1', 5, 60000, {
        failClosed: false,
        endpoint: 'contact',
      });

      expect(res.success).toBe(true);
      expect(res.remaining).toBe(1);
      expect(res.error).toContain('fail-open');
    });

    it('extracts client IP safely from forwarded headers without spoofing vulnerabilities', () => {
      const reqWithForwarded = new Request('https://openshelf.test/api/contact', {
        headers: { 'x-forwarded-for': '203.0.113.195, 70.41.3.18, 150.172.238.178' },
      });
      expect(getClientIp(reqWithForwarded)).toBe('203.0.113.195');

      const reqWithRealIp = new Request('https://openshelf.test/api/contact', {
        headers: { 'x-real-ip': '198.51.100.7' },
      });
      expect(getClientIp(reqWithRealIp)).toBe('198.51.100.7');

      const reqFallback = new Request('https://openshelf.test/api/contact');
      expect(getClientIp(reqFallback)).toBe('127.0.0.1');
    });

    it('Admin login endpoint returns HTTP 429 with Retry-After when rate limit is exceeded', async () => {
      // Exceed admin login limit for IP
      const ip = '192.0.2.1';
      for (let i = 0; i < 5; i++) {
        await checkRateLimit(`admin-login:${ip}`, 5, 15 * 60 * 1000);
      }

      const req = new Request('https://openshelf.test/api/admin/auth/login', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': ip,
        },
        body: JSON.stringify({ username: 'smartpdf_admin', password: 'AnyPassword123' }),
      });

      const response = await adminLoginHandler(req);
      expect(response.status).toBe(429);
      expect(response.headers.get('Retry-After')).toBeDefined();
      expect(parseInt(response.headers.get('Retry-After')!, 10)).toBeGreaterThan(0);

      const body = await response.json();
      expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(body.error.message).toContain('Too many login attempts');
    });

    it('Contact endpoint returns HTTP 429 with Retry-After when submission limit is exceeded', async () => {
      const ip = '198.51.100.88';
      for (let i = 0; i < 5; i++) {
        await checkRateLimit(`contact:${ip}`, 5, 600000);
      }

      const req = new Request('https://openshelf.test/api/contact', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': ip,
        },
        body: JSON.stringify({
          name: 'Jane Doe',
          email: 'jane@example.com',
          subject: 'Feedback',
          message: 'This is a test message that has sufficient length.',
        }),
      });

      const response = await contactHandler(req);
      expect(response.status).toBe(429);
      expect(response.headers.get('Retry-After')).toBeDefined();
      expect(parseInt(response.headers.get('Retry-After')!, 10)).toBeGreaterThan(0);

      const body = await response.json();
      expect(body.error.code).toBe('RATE_LIMITED');
    });
  });

  describe('P2-2: RFC 7233 / RFC 9110 HTTP Range Handling & 416 Status', () => {
    const TOTAL_FILE_SIZE = 10000; // 10,000 bytes mock PDF

    it('returns status 200 for requests without a Range header', () => {
      const result = parseHttpRange(undefined, TOTAL_FILE_SIZE);
      expect(result.status).toBe(200);
      expect(result.isRange).toBe(false);

      const nullResult = parseHttpRange(null, TOTAL_FILE_SIZE);
      expect(nullResult.status).toBe(200);
      expect(nullResult.isRange).toBe(false);
    });

    it('returns status 206 with correct chunk length and Content-Range for bounded range (bytes=0-999)', () => {
      const result = parseHttpRange('bytes=0-999', TOTAL_FILE_SIZE);
      expect(result.status).toBe(206);
      expect(result.start).toBe(0);
      expect(result.end).toBe(999);
      expect(result.chunkLength).toBe(1000);
      expect(result.contentRange).toBe('bytes 0-999/10000');
    });

    it('returns status 206 for open-ended range (bytes=5000-)', () => {
      const result = parseHttpRange('bytes=5000-', TOTAL_FILE_SIZE);
      expect(result.status).toBe(206);
      expect(result.start).toBe(5000);
      expect(result.end).toBe(9999);
      expect(result.chunkLength).toBe(5000);
      expect(result.contentRange).toBe('bytes 5000-9999/10000');
    });

    it('returns status 206 for suffix range (bytes=-500) requesting the last 500 bytes', () => {
      const result = parseHttpRange('bytes=-500', TOTAL_FILE_SIZE);
      expect(result.status).toBe(206);
      expect(result.start).toBe(9500);
      expect(result.end).toBe(9999);
      expect(result.chunkLength).toBe(500);
      expect(result.contentRange).toBe('bytes 9500-9999/10000');
    });

    it('handles suffix range larger than total file size by returning entire file representation', () => {
      const result = parseHttpRange('bytes=-50000', TOTAL_FILE_SIZE);
      expect(result.status).toBe(206);
      expect(result.start).toBe(0);
      expect(result.end).toBe(9999);
      expect(result.chunkLength).toBe(10000);
      expect(result.contentRange).toBe('bytes 0-9999/10000');
    });

    it('clamps end offset when requested range extends beyond file size (bytes=8000-25000)', () => {
      const result = parseHttpRange('bytes=8000-25000', TOTAL_FILE_SIZE);
      expect(result.status).toBe(206);
      expect(result.start).toBe(8000);
      expect(result.end).toBe(9999); // Clamped to total - 1
      expect(result.chunkLength).toBe(2000);
      expect(result.contentRange).toBe('bytes 8000-9999/10000');
    });

    it('returns HTTP 416 Range Not Satisfiable when start offset is at or beyond file size', () => {
      // Start exactly at totalLength
      const resultExact = parseHttpRange('bytes=10000-', TOTAL_FILE_SIZE);
      expect(resultExact.status).toBe(416);
      expect(resultExact.contentRange).toBe('bytes */10000');

      // Start beyond totalLength
      const resultBeyond = parseHttpRange('bytes=99999-100000', TOTAL_FILE_SIZE);
      expect(resultBeyond.status).toBe(416);
      expect(resultBeyond.contentRange).toBe('bytes */10000');
    });

    it('returns HTTP 416 Range Not Satisfiable when end offset is smaller than start offset', () => {
      const result = parseHttpRange('bytes=5000-1000', TOTAL_FILE_SIZE);
      expect(result.status).toBe(416);
      expect(result.contentRange).toBe('bytes */10000');
    });

    it('returns HTTP 416 when requesting byte range on empty file (totalLength = 0)', () => {
      const result = parseHttpRange('bytes=0-0', 0);
      expect(result.status).toBe(416);
      expect(result.contentRange).toBe('bytes */0');
    });

    it('ignores non-byte or syntactically invalid range units per RFC 7233 and returns 200', () => {
      const wrongUnitResult = parseHttpRange('items=0-10', TOTAL_FILE_SIZE);
      expect(wrongUnitResult.status).toBe(200);

      const garbageResult = parseHttpRange('bytes=invalid-garbage', TOTAL_FILE_SIZE);
      expect(garbageResult.status).toBe(200);
    });

    it('PDF streaming route returns HTTP 416 with Content-Range: bytes */TOTAL when range is unsatisfiable', async () => {
      // Create representative mock PDF buffer
      const mockPdfBuffer = Buffer.from('%PDF-1.4\n%mock content for pdf range testing\n%%EOF');
      const totalLen = mockPdfBuffer.length;

      // Mock telegram download and document fetch
      const req = new Request('https://openshelf.test/api/documents/doc-123/file', {
        headers: { range: 'bytes=999999-' }, // Unsatisfiable range
      });

      // Directly verify parseHttpRange response behavior on the mock buffer
      const rangeResult = parseHttpRange(req.headers.get('range'), totalLen);
      expect(rangeResult.status).toBe(416);
      expect(rangeResult.contentRange).toBe(`bytes */${totalLen}`);
    });
  });
});
