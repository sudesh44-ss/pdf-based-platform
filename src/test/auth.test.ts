import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sanitizeRedirect, isProtectedPath } from '../middleware';
import { isUserAdmin, ensureUserProfile } from '../lib/services/authService';

describe('Google Authentication & Session Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Open Redirect Prevention (sanitizeRedirect)', () => {
    it('accepts valid internal paths', () => {
      expect(sanitizeRedirect('/dashboard')).toBe('/dashboard');
      expect(sanitizeRedirect('/my-library')).toBe('/my-library');
      expect(sanitizeRedirect('/notes?notebook_id=123')).toBe('/notes?notebook_id=123');
    });

    it('rejects external URL open redirect attacks', () => {
      expect(sanitizeRedirect('https://evil.attacker.com')).toBe('/dashboard');
      expect(sanitizeRedirect('http://malicious.site/phish')).toBe('/dashboard');
      expect(sanitizeRedirect('//evil.attacker.com')).toBe('/dashboard');
      expect(sanitizeRedirect('/\\evil.attacker.com')).toBe('/dashboard');
      expect(sanitizeRedirect('javascript:alert(1)')).toBe('/dashboard');
    });

    it('falls back to /dashboard on empty or null values', () => {
      expect(sanitizeRedirect(null)).toBe('/dashboard');
      expect(sanitizeRedirect('')).toBe('/dashboard');
    });
  });

  describe('Route Protection Configuration', () => {
    it('identifies private protected routes correctly', () => {
      expect(isProtectedPath('/dashboard')).toBe(true);
      expect(isProtectedPath('/my-library')).toBe(true);
      expect(isProtectedPath('/notes')).toBe(true);
      expect(isProtectedPath('/notebooks')).toBe(true);
      expect(isProtectedPath('/bookmarks')).toBe(true);
      expect(isProtectedPath('/highlights')).toBe(true);
      expect(isProtectedPath('/storage')).toBe(true);
      expect(isProtectedPath('/statistics')).toBe(true);
      expect(isProtectedPath('/settings')).toBe(true);
      expect(isProtectedPath('/profile')).toBe(true);
      expect(isProtectedPath('/my-contributions')).toBe(true);
    });

    it('identifies public routes correctly', () => {
      expect(isProtectedPath('/')).toBe(false);
      expect(isProtectedPath('/library')).toBe(false);
      expect(isProtectedPath('/library/doc-123')).toBe(false);
      expect(isProtectedPath('/search')).toBe(false);
      expect(isProtectedPath('/terms')).toBe(false);
      expect(isProtectedPath('/privacy')).toBe(false);
      expect(isProtectedPath('/copyright')).toBe(false);
      expect(isProtectedPath('/help')).toBe(false);
      expect(isProtectedPath('/contact')).toBe(false);
      expect(isProtectedPath('/auth/login')).toBe(false);
    });
  });

  describe('Admin Authorization Checks', () => {
    it('grants admin privileges if user email is present in ADMIN_EMAILS', async () => {
      process.env.ADMIN_EMAILS = 'admin@example.com,lead@platform.org';

      const adminUser: any = { id: 'usr-1', email: 'admin@example.com' };
      const nonAdminUser: any = { id: 'usr-2', email: 'user@example.com' };

      const isAdmin = await isUserAdmin(null, adminUser);
      const isNotAdmin = await isUserAdmin(null, nonAdminUser);

      expect(isAdmin).toBe(true);
      expect(isNotAdmin).toBe(false);
    });

    it('grants admin privileges if database profile role is admin or moderator', async () => {
      process.env.ADMIN_EMAILS = 'superadmin@example.com';

      const mockSupabaseAdmin: any = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { role: 'admin' },
                error: null,
              }),
            }),
          }),
        }),
      };

      const user: any = { id: 'usr-admin-db', email: 'regular@example.com' };
      const result = await isUserAdmin(mockSupabaseAdmin, user);
      expect(result).toBe(true);
    });

    it('rejects regular users who are not in ADMIN_EMAILS and have role=user', async () => {
      process.env.ADMIN_EMAILS = 'superadmin@example.com';

      const mockSupabaseUser: any = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { role: 'user' },
                error: null,
              }),
            }),
          }),
        }),
      };

      const user: any = { id: 'usr-regular', email: 'regular@example.com' };
      const result = await isUserAdmin(mockSupabaseUser, user);
      expect(result).toBe(false);
    });
  });

  describe('User Profile Auto-Provisioning & Synchronization', () => {
    it('returns existing profile without duplicate insertion if already present', async () => {
      const existingProfile = {
        id: 'usr-existing',
        email: 'dev@smartpdf.io',
        full_name: 'Existing Dev',
        avatar_url: 'https://avatar.url',
        role: 'user',
      };

      const mockSupabase: any = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: existingProfile, error: null }),
            }),
          }),
        }),
      };

      const user: any = { id: 'usr-existing', email: 'dev@smartpdf.io' };
      const profile = await ensureUserProfile(mockSupabase, user);

      expect(profile).toEqual(existingProfile);
      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
    });

    it('creates profile with non-privileged role user for newly registered OAuth users', async () => {
      process.env.ADMIN_EMAILS = 'admin@example.com';

      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'usr-new',
              email: 'newuser@gmail.com',
              full_name: 'New User',
              avatar_url: 'https://lh3.googleusercontent.com/photo.jpg',
              role: 'user',
            },
            error: null,
          }),
        }),
      });

      const mockSupabase: any = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'profiles') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
              insert: insertMock,
            };
          }
          return {};
        }),
      };

      const user: any = {
        id: 'usr-new',
        email: 'newuser@gmail.com',
        user_metadata: {
          full_name: 'New User',
          avatar_url: 'https://lh3.googleusercontent.com/photo.jpg',
        },
      };

      const created = await ensureUserProfile(mockSupabase, user);

      expect(created?.role).toBe('user');
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'usr-new',
          email: 'newuser@gmail.com',
          role: 'user',
        })
      );
    });
  });
});
