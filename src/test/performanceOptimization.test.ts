// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import nextConfig from '../../next.config';
import { telegramClient } from '../lib/telegram/client';

// Mock Supabase server client for route handler testing
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                range: vi.fn().mockResolvedValue({
                  data: [],
                  count: 0,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    }),
  }),
}));

import { GET as documentsGetHandler } from '../app/api/documents/route';

describe('OpenShelf — Performance Optimization Verification', () => {
  describe('Telegram PDF Buffer & Path In-Memory Caching', () => {
    beforeEach(() => {
      telegramClient.clearCache();
    });

    afterEach(() => {
      telegramClient.clearCache();
    });

    it('caches downloaded PDF buffer in memory to eliminate redundant Telegram round-trips on sequential range requests', async () => {
      const fileId = 'sim_tg_performance_test_file_001';

      // Initial download (loads and populates buffer cache)
      const res1 = await telegramClient.downloadPdf(fileId);
      expect(res1.success).toBe(true);
      expect(res1.buffer).toBeDefined();

      const statusAfterFirst = telegramClient.getStatus();
      expect(statusAfterFirst.cachedPdfsCount).toBe(1);
      expect(statusAfterFirst.cachedBytes).toBeGreaterThan(0);

      // Second download for subsequent range chunk (must return from RAM cache)
      const start = performance.now();
      const res2 = await telegramClient.downloadPdf(fileId);
      const duration = performance.now() - start;

      expect(res2.success).toBe(true);
      expect(res2.buffer).toBeDefined();
      expect(res2.sha256).toBe(res1.sha256);
      expect(duration).toBeLessThan(15); // In-memory read takes < 15ms
    });

    it('clearCache resets cached items and memory counter', async () => {
      await telegramClient.downloadPdf('sim_tg_clear_test_001');
      expect(telegramClient.getStatus().cachedPdfsCount).toBe(1);

      telegramClient.clearCache();
      expect(telegramClient.getStatus().cachedPdfsCount).toBe(0);
      expect(telegramClient.getStatus().cachedBytes).toBe(0);
    });
  });

  describe('Edge & CDN Caching Headers', () => {
    it('GET /api/documents?public=true returns public Cache-Control headers for Edge caching', async () => {
      const req = new Request('https://openshelf.test/api/documents?public=true');
      const res = await documentsGetHandler(req);

      expect(res.headers.get('Cache-Control')).toContain('public');
      expect(res.headers.get('Cache-Control')).toContain('s-maxage=30');
      expect(res.headers.get('Cache-Control')).toContain('stale-while-revalidate=120');
    });

    it('next.config.ts configures HTTP response compression and lucide-react package import optimization', () => {
      expect(nextConfig.compress).toBe(true);
      expect(nextConfig.experimental?.optimizePackageImports).toContain('lucide-react');
    });
  });

  describe('Homepage Server Component Architecture', () => {
    it('Homepage is a Server Component with edge ISR revalidation and without use client directive', async () => {
      const fs = await import('fs');
      const pageCode = fs.readFileSync('src/app/page.tsx', 'utf8');

      // Must not be a client component
      expect(pageCode.startsWith("'use client'")).toBe(false);
      expect(pageCode.startsWith('"use client"')).toBe(false);

      // Must configure ISR revalidation
      expect(pageCode).toContain('export const revalidate = 60');

      // Must be an async server component
      expect(pageCode).toContain('export default async function HomePage()');
    });
  });
});
