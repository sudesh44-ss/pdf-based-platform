// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import nextConfig from '../../next.config';
import {
  clientEnvSchema,
  serverOnlyEnvSchema,
  serverEnvSchema,
  validateProductionEnv,
} from '../lib/env';

describe('OpenShelf — P1 Production Improvements Verification', () => {
  describe('P1-1: Native PDF Text Selection & Copy Architecture', () => {
    it('PdfViewer module styles contain required text layer CSS definitions', async () => {
      const fs = await import('fs');
      const css = fs.readFileSync('src/components/reader/PdfViewer.module.css', 'utf8');

      // Verify text layer class and essential properties
      expect(css).toContain('.textLayer');
      expect(css).toContain('position: absolute');
      expect(css).toContain('user-select: text');
      expect(css).toContain('-webkit-user-select: text');
      expect(css).toContain('color: transparent');
      expect(css).toContain('--min-font-size');
      expect(css).toContain('--total-scale-factor');
      expect(css).toContain('::selection');
      expect(css).toContain('background: rgba(0, 102, 204, 0.35)');
    });

    it('PdfViewer component contains textLayer reference and renderTextLayer/TextLayer integration', async () => {
      const fs = await import('fs');
      const viewerCode = fs.readFileSync('src/components/reader/PdfViewer.tsx', 'utf8');

      // Verify refs and container
      expect(viewerCode).toContain('textLayerRef = useRef<HTMLDivElement>(null)');
      expect(viewerCode).toContain('currentTextLayerRef = useRef<any>(null)');
      expect(viewerCode).toContain('<div ref={textLayerRef} className={`${styles.textLayer} textLayer`} />');

      // Verify PDF.js TextLayer invocation
      expect(viewerCode).toContain('page.getTextContent()');
      expect(viewerCode).toContain('new pdfjs.TextLayer');
      expect(viewerCode).toContain('textLayer.render()');

      // Verify scale properties are set for CSS calculations
      expect(viewerCode).toContain("textLayerDiv.style.setProperty('--scale-factor', `${viewport.scale}`)");
      expect(viewerCode).toContain("textLayerDiv.style.setProperty('--total-scale-factor', `${viewport.scale}`)");
    });

    it('Preserves native clipboard operations (Ctrl+C / Cmd+C / Ctrl+A) without triggering reader shortcuts', async () => {
      const fs = await import('fs');
      const viewerCode = fs.readFileSync('src/components/reader/PdfViewer.tsx', 'utf8');

      // Verify that modifier keys are checked before executing single-key shortcuts
      expect(viewerCode).toContain('if (e.ctrlKey || e.metaKey || e.altKey)');
      expect(viewerCode).toContain('return;');
    });
  });

  describe('P1-2: Content Security Policy (CSP) Configuration', () => {
    it('next.config.ts configures a comprehensive Content-Security-Policy header', async () => {
      const headersConfig = await nextConfig.headers?.();
      expect(headersConfig).toBeDefined();

      const globalHeaders = headersConfig?.find((h) => h.source === '/:path*')?.headers;
      expect(globalHeaders).toBeDefined();

      const csp = globalHeaders?.find((h) => h.key === 'Content-Security-Policy')?.value;
      expect(csp).toBeDefined();

      // Required directives
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self' 'unsafe-inline'");
      expect(csp).toContain('https://cdn.jsdelivr.net');
      expect(csp).toContain("style-src 'self' 'unsafe-inline'");
      expect(csp).toContain("img-src 'self' data: blob:");
      expect(csp).toContain('https://*.googleusercontent.com');
      expect(csp).toContain('https://*.supabase.co');
      expect(csp).toContain("font-src 'self' data:");
      expect(csp).toContain("connect-src 'self'");
      expect(csp).toContain('wss://*.supabase.co');
      expect(csp).toContain('https://api.telegram.org');
      expect(csp).toContain("frame-src 'self'");
      expect(csp).toContain("frame-ancestors 'self'");
      expect(csp).toContain("worker-src 'self' blob:");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("form-action 'self'");
      expect(csp).toContain('upgrade-insecure-requests');
    });

    it('next.config.ts includes clickjacking protection headers', async () => {
      const headersConfig = await nextConfig.headers?.();
      const globalHeaders = headersConfig?.find((h) => h.source === '/:path*')?.headers;

      const frameOptions = globalHeaders?.find((h) => h.key === 'X-Frame-Options')?.value;
      expect(frameOptions).toBe('SAMEORIGIN');

      const contentTypeOptions = globalHeaders?.find((h) => h.key === 'X-Content-Type-Options')?.value;
      expect(contentTypeOptions).toBe('nosniff');
    });

    it('Production CSP forbids unsafe-eval', async () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
        // Verify conditional inclusion of unsafe-eval only in non-production
        const fs = await import('fs');
        const configCode = fs.readFileSync('next.config.ts', 'utf8');

        expect(configCode).toContain("const isDev = process.env.NODE_ENV !== 'production'");
        expect(configCode).toContain("isDev ? \"'unsafe-eval' \" : ''");
      } finally {
        (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
      }
    });
  });

  describe('P1-3: Centralized Environment Variable Validation', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it('Validates clientEnvSchema with public variables only', () => {
      const valid = clientEnvSchema.safeParse({
        NEXT_PUBLIC_APP_URL: 'https://openshelf.example.com',
        NEXT_PUBLIC_SUPABASE_URL: 'https://xyzcompany.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy',
      });

      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.NEXT_PUBLIC_APP_URL).toBe('https://openshelf.example.com');
        expect(valid.data.NEXT_PUBLIC_SUPABASE_URL).toBe('https://xyzcompany.supabase.co');
      }
    });

    it('Rejects invalid URLs in clientEnvSchema', () => {
      const result = clientEnvSchema.safeParse({
        NEXT_PUBLIC_APP_URL: 'not-a-valid-url',
      });
      expect(result.success).toBe(false);
    });

    it('Enforces minimum 16-character length on ADMIN_SESSION_SECRET', () => {
      const shortSecretResult = serverOnlyEnvSchema.safeParse({
        ADMIN_SESSION_SECRET: 'too-short',
      });
      expect(shortSecretResult.success).toBe(false);

      const validSecretResult = serverOnlyEnvSchema.safeParse({
        ADMIN_SESSION_SECRET: 'a-sufficiently-long-secret-key-32b',
      });
      expect(validSecretResult.success).toBe(true);
    });

    it('Validates server-only variables without crashing when optional services are omitted', () => {
      const parsed = serverEnvSchema.safeParse({
        NEXT_PUBLIC_APP_URL: 'https://openshelf.example.com',
        ADMIN_USERNAME: 'admin',
        TELEGRAM_API_BASE_URL: 'https://api.telegram.org',
      });

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.ADMIN_USERNAME).toBe('admin');
        expect(parsed.data.ADMIN_SESSION_DURATION_HOURS).toBe(8);
        expect(parsed.data.MAX_UPLOAD_BYTES).toBe(104857600);
      }
    });

    it('validateProductionEnv correctly flags missing production credentials', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      delete process.env.ADMIN_PASSWORD_HASH;
      delete process.env.TELEGRAM_BOT_TOKEN;
      delete process.env.TELEGRAM_WEBHOOK_SECRET;

      const result = validateProductionEnv();
      expect(result.valid).toBe(false);
      expect(result.missingVariables).toContain('NEXT_PUBLIC_SUPABASE_URL');
      expect(result.missingVariables).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
      expect(result.missingVariables).toContain('SUPABASE_SERVICE_ROLE_KEY');
      expect(result.missingVariables).toContain('ADMIN_PASSWORD_HASH');
      expect(result.missingVariables).toContain('TELEGRAM_BOT_TOKEN');
      expect(result.missingVariables).toContain('TELEGRAM_WEBHOOK_SECRET');
    });

    it('validateProductionEnv passes when all production credentials are configured', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://live-project.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'live-anon-jwt-token';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'live-service-role-jwt-token';
      process.env.ADMIN_PASSWORD_HASH = 'scrypt:abc:def';
      process.env.ADMIN_SESSION_SECRET = 'a-secure-production-random-salt-hex-64';
      process.env.TELEGRAM_BOT_TOKEN = '123456789:ABCDefGhIJKlmNoPQRsTUVwxyZ';
      process.env.TELEGRAM_WEBHOOK_SECRET = 'my-webhook-secret-token-32b';
      process.env.TELEGRAM_ALLOWED_CHAT_IDS = '-1001234567890';

      const result = validateProductionEnv();
      expect(result.valid).toBe(true);
      expect(result.missingVariables.length).toBe(0);
      expect(result.warnings.length).toBe(0);
    });
  });
});
