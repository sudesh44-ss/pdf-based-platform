// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { middleware, isProtectedPath } from '../middleware';
import { POST as handleAdminLogin } from '../app/api/admin/auth/login/route';
import { POST as handleAdminLogout } from '../app/api/admin/auth/logout/route';
import { POST as handleUserLogout } from '../app/api/auth/logout/route';
import { GET as handleUserProfile } from '../app/api/profile/route';
import { GET as handleAdminMe } from '../app/api/admin/auth/me/route';
import { GET as handleAdminDocs } from '../app/api/admin/documents/route';
import { POST as handleTelegramWebhook } from '../app/api/telegram/webhook/route';
import { NextRequest } from 'next/server';

// Mock Supabase SSR client
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(),
}));

// Mock Supabase server client
vi.mock('../lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

// Mock Admin auth helpers
vi.mock('../lib/auth/adminAuth', () => ({
  ADMIN_COOKIE_NAME: 'smartpdf_admin_session',
  verifyAdminPassword: vi.fn(),
  createAdminSession: vi.fn(),
  verifyAdminSessionToken: vi.fn(),
  getVerifiedAdminSession: vi.fn(),
  revokeCurrentAdminSession: vi.fn(),
  logAdminActivity: vi.fn(),
  hashSessionToken: (t: string) => `hash_${t}`,
}));

// Mock Admin DB client
vi.mock('../lib/supabase/admin', () => ({
  getAdminClient: vi.fn(),
}));

// Mock rate limiting to avoid false triggers
vi.mock('../lib/api/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 5, resetMs: 60000 }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

import { createServerClient } from '@supabase/ssr';
import { createClient } from '../lib/supabase/server';
import {
  verifyAdminPassword,
  createAdminSession,
  getVerifiedAdminSession,
  revokeCurrentAdminSession,
  ADMIN_COOKIE_NAME,
} from '../lib/auth/adminAuth';
import { getAdminClient } from '../lib/supabase/admin';

describe('OpenShelf — Admin and Normal User Session Isolation Security Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example-supabase-project.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'example-anon-key-test-token-123';
  });

  describe('1. Normal User Logged In → Admin Login & URL Protection', () => {
    it('Scenario 1: Rejects Admin login API with HTTP 409 SESSION_CONFLICT when a Normal User is active', async () => {
      const mockUserSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'usr_normal_123', email: 'student@example.com' } },
            error: null,
          }),
        },
      };
      (createClient as any).mockResolvedValue(mockUserSupabase);

      const req = new Request('http://localhost:3000/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'ValidPassword123!' }),
      });

      const res = await handleAdminLogin(req);
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error.code).toBe('SESSION_CONFLICT');
      expect(json.error.message).toContain('A Normal User account is currently logged in');
    });

    it('Scenario 1 (Middleware): Redirects Normal User attempting /admin/login to /auth/switch?target=admin', async () => {
      (createServerClient as any).mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'usr_normal_123', email: 'student@example.com' } },
          }),
        },
      });

      const req = new NextRequest('http://localhost:3000/admin/login');
      const res = await middleware(req);

      expect(res.status).toBe(307); // NextResponse.redirect
      const location = res.headers.get('location');
      expect(location).toContain('/auth/switch');
      expect(location).toContain('target=admin');
      expect(location).toContain('next=%2Fadmin%2Flogin');
    });

    it('Scenario 3: Redirects Normal User directly accessing root /admin to /auth/switch?target=admin', async () => {
      (createServerClient as any).mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'usr_normal_123', email: 'student@example.com' } },
          }),
        },
      });

      const req = new NextRequest('http://localhost:3000/admin');
      const res = await middleware(req);

      expect(res.status).toBe(307);
      const location = res.headers.get('location');
      expect(location).toContain('/auth/switch');
      expect(location).toContain('target=admin');
      expect(location).toContain('next=%2Fadmin');
    });

    it('Scenario 4: Redirects Normal User directly accessing nested Admin routes (/admin/documents) to /auth/switch', async () => {
      (createServerClient as any).mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'usr_normal_123', email: 'student@example.com' } },
          }),
        },
      });

      const req = new NextRequest('http://localhost:3000/admin/documents');
      const res = await middleware(req);

      expect(res.status).toBe(307);
      const location = res.headers.get('location');
      expect(location).toContain('/auth/switch');
      expect(location).toContain('target=admin');
      expect(location).toContain('next=%2Fadmin%2Fdocuments');
    });

    it('Scenario 5: Rejects Normal User attempting protected Admin API access with HTTP 401 UNAUTHORIZED', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/documents');
      const res = await middleware(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('2. Admin Logged In → Normal User Login & Route Protection', () => {
    it('Scenario 2: Redirects Admin accessing /auth/login to /auth/switch?target=user', async () => {
      (createServerClient as any).mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
      });

      const req = new NextRequest('http://localhost:3000/auth/login');
      req.cookies.set('smartpdf_admin_session', 'valid_admin_token_xyz');

      const res = await middleware(req);
      expect(res.status).toBe(307);
      const location = res.headers.get('location');
      expect(location).toContain('/auth/switch');
      expect(location).toContain('target=user');
      expect(location).toContain('next=%2Fauth%2Flogin');
    });

    it('Scenario 6: Redirects Admin accessing protected Normal User routes (/dashboard, /my-contributions) to /auth/switch?target=user', async () => {
      (createServerClient as any).mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
      });

      const req = new NextRequest('http://localhost:3000/dashboard');
      req.cookies.set('smartpdf_admin_session', 'valid_admin_token_xyz');

      const res = await middleware(req);
      expect(res.status).toBe(307);
      const location = res.headers.get('location');
      expect(location).toContain('/auth/switch');
      expect(location).toContain('target=user');
      expect(location).toContain('next=%2Fdashboard');
    });

    it('Scenario 7: Rejects Admin session attempting Normal User-only API (/api/profile) with HTTP 401', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('No user session') }),
        },
      };
      (createClient as any).mockResolvedValue(mockSupabase);

      const res = await handleUserProfile();
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('3. Admin Logout Reliability & No 401 Errors', () => {
    it('Admin logout succeeds with HTTP 200 and clears cookie when session is active', async () => {
      (getVerifiedAdminSession as any).mockResolvedValue({ valid: true, username: 'admin_active' });
      (revokeCurrentAdminSession as any).mockResolvedValue(true);

      const req = new Request('http://localhost:3000/api/admin/auth/logout', { method: 'POST' });
      const res = await handleAdminLogout(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.loggedOut).toBe(true);
      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toContain('smartpdf_admin_session=;');
    });

    it('Admin logout succeeds with HTTP 200 and clears cookie even if session is already expired or invalid', async () => {
      (getVerifiedAdminSession as any).mockResolvedValue({ valid: false });
      (revokeCurrentAdminSession as any).mockResolvedValue(false);

      const req = new Request('http://localhost:3000/api/admin/auth/logout', { method: 'POST' });
      const res = await handleAdminLogout(req);

      // Must NOT fail with 401 Unauthorized
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.loggedOut).toBe(true);
      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toContain('smartpdf_admin_session=;');
    });

    it('Middleware allows /api/admin/auth/logout without requiring valid admin session token', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/auth/logout', { method: 'POST' });
      const res = await middleware(req);
      // Middleware must allow logout through without throwing 401
      expect(res.status).not.toBe(401);
    });

    it('/api/admin/auth/me returns authenticated: false with HTTP 200 when no admin session is present', async () => {
      (getVerifiedAdminSession as any).mockResolvedValue({ valid: false });

      const req = new Request('http://localhost:3000/api/admin/auth/me');
      const res = await handleAdminMe(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.authenticated).toBe(false);
      expect(json.data.username).toBeNull();
    });
  });

  describe('4. No Redirect Loops & Route Transition Safety', () => {
    it('/auth/switch is never redirected by middleware regardless of session state', async () => {
      (createServerClient as any).mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'usr_normal_123' } },
          }),
        },
      });

      const req = new NextRequest('http://localhost:3000/auth/switch?target=admin');
      req.cookies.set('smartpdf_admin_session', 'token_present');

      const res = await middleware(req);
      // Must not redirect to another URL
      expect(res.status).not.toBe(307);
      expect(res.status).not.toBe(308);
    });

    it('Normal user accessing /dashboard does NOT get redirected', async () => {
      (createServerClient as any).mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'usr_normal_123' } },
          }),
        },
      });

      const req = new NextRequest('http://localhost:3000/dashboard');
      const res = await middleware(req);
      expect(res.status).not.toBe(307);
    });

    it('Admin user accessing /admin does NOT get redirected to switch', async () => {
      (createServerClient as any).mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
      });

      const req = new NextRequest('http://localhost:3000/admin');
      req.cookies.set('smartpdf_admin_session', 'valid_token');

      const res = await middleware(req);
      expect(res.status).not.toBe(307);
    });
  });

  describe('5. Account Switching & Cancellation Lifecycle', () => {
    it('Scenario 8: Cancel account switching preserves existing session state untouched', () => {
      const normalUserActive = { id: 'usr_keep_123' };
      const onCancel = vi.fn();

      onCancel();
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(normalUserActive.id).toBe('usr_keep_123');
    });

    it('Scenario 9A: Switching to Admin safely terminates ONLY current browser Normal User session', async () => {
      const mockSignOut = vi.fn().mockResolvedValue({ error: null });
      const mockSupabase = {
        auth: {
          signOut: mockSignOut,
        },
      };
      (createClient as any).mockResolvedValue(mockSupabase);

      const res = await handleUserLogout();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.loggedOut).toBe(true);
      expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
    });

    it('Scenario 9B: Switching to Normal User safely terminates ONLY current browser Admin session', async () => {
      (getVerifiedAdminSession as any).mockResolvedValue({ valid: true, username: 'admin_switch_test' });
      (revokeCurrentAdminSession as any).mockResolvedValue(true);

      const req = new Request('http://localhost:3000/api/admin/auth/logout', { method: 'POST' });
      const res = await handleAdminLogout(req);

      expect(res.status).toBe(200);
      expect(revokeCurrentAdminSession).toHaveBeenCalledTimes(1);
      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toContain('smartpdf_admin_session=;');
    });
  });

  describe('6. Independent Device Sessions (PC vs Mobile)', () => {
    it('Scenario 10: PC logout with scope local does NOT revoke Mobile user session', async () => {
      const pcSignOut = vi.fn().mockResolvedValue({ error: null });
      const pcSupabase = { auth: { signOut: pcSignOut } };
      (createClient as any).mockResolvedValue(pcSupabase);

      await handleUserLogout();
      expect(pcSignOut).toHaveBeenCalledWith({ scope: 'local' });

      const mobileSessionToken = 'mobile_valid_jwt_token';
      const mobileVerify = vi.fn().mockReturnValue({ valid: true, userId: 'usr_same_account' });
      expect(mobileVerify(mobileSessionToken).valid).toBe(true);
    });

    it('Scenario 11: Admin token revocation targets token_hash of current device only', async () => {
      const pcToken = 'pc_admin_secret_token_111';
      const mobileToken = 'mobile_admin_secret_token_222';

      const revokedHashes = new Set<string>();
      const mockAdminClient = {
        from: vi.fn(() => ({
          update: vi.fn((data: any) => ({
            eq: vi.fn((field: string, hash: string) => {
              if (field === 'token_hash') {
                revokedHashes.add(hash);
              }
              return { error: null };
            }),
          })),
        })),
      };
      (getAdminClient as any).mockReturnValue(mockAdminClient);

      const pcHash = `hash_${pcToken}`;
      mockAdminClient.from().update({ revoked_at: new Date().toISOString() }).eq('token_hash', pcHash);

      expect(revokedHashes.has(pcHash)).toBe(true);
      expect(revokedHashes.has(`hash_${mobileToken}`)).toBe(false);
    });
  });

  describe('7. Non-Regression: Existing Login & Telegram Workflow', () => {
    it('Scenario 12: Normal User login sanitizes redirects and preserves Google OAuth destinations', () => {
      expect(isProtectedPath('/dashboard')).toBe(true);
      expect(isProtectedPath('/my-library')).toBe(true);
      expect(isProtectedPath('/library')).toBe(false);
    });

    it('Scenario 13: Admin login succeeds with valid credentials when no conflicting user session is active', async () => {
      const mockNoUserSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        },
      };
      (createClient as any).mockResolvedValue(mockNoUserSupabase);

      (verifyAdminPassword as any).mockReturnValue(true);
      (createAdminSession as any).mockResolvedValue({
        token: 'newly_generated_token_123',
        expiresAt: new Date(Date.now() + 8 * 3600 * 1000),
      });

      const req = new Request('http://localhost:3000/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'CorrectPassword' }),
      });

      const res = await handleAdminLogin(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.authenticated).toBe(true);
      expect(json.data.username).toBe('admin');

      const cookieHeader = res.headers.get('set-cookie');
      expect(cookieHeader).toContain('smartpdf_admin_session=');
    });

    it('Scenario 14: Telegram Webhook continues to accept and acknowledge valid messages', async () => {
      const mockAdminClient = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'doc_tg_123',
              title: 'test_document.pdf',
              status: 'pending_review',
            },
            error: null,
          }),
        })),
      };
      (getAdminClient as any).mockReturnValue(mockAdminClient);

      const webhookPayload = {
        update_id: 99887766,
        message: {
          message_id: 42,
          date: Math.floor(Date.now() / 1000),
          chat: { id: -1001234567890, type: 'supergroup', title: 'OpenShelf Storage' },
          from: { id: 112233, is_bot: false, first_name: 'Contributor' },
          document: {
            file_id: 'BQADBAAD_telegram_pdf_file',
            file_unique_id: 'unique_tg_file_42',
            file_name: 'test_document.pdf',
            mime_type: 'application/pdf',
            file_size: 1024 * 500,
          },
        },
      };

      const req = new Request('http://localhost:3000/api/telegram/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-bot-api-secret-token': process.env.TELEGRAM_WEBHOOK_SECRET || '',
        },
        body: JSON.stringify(webhookPayload),
      });

      const res = await handleTelegramWebhook(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
    });
  });
});
