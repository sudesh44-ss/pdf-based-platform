import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateDocument, deleteDocument, getDocumentById } from '../lib/services/documentService';
import { updateUserProfile } from '../lib/services/authService';
import { reviewSubmission } from '../lib/services/moderationService';
import { createAdminClient } from '../lib/supabase/admin';

describe('Security Hardening & Threat Mitigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Insecure Direct Object Reference (IDOR) Defense', () => {
    it('prevents attacker from accessing private document belonging to another user', async () => {
      const victimDoc = {
        id: 'doc-private-123',
        user_id: 'victim-user-id',
        title: 'Confidential Strategy Report',
        is_public: false,
        status: 'published',
        is_trash: false,
      };

      const mockSupabase: any = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: victimDoc,
                error: null,
              }),
            }),
          }),
        }),
      };

      // Attacker 'attacker-id' attempts to fetch victim's private doc
      const result = await getDocumentById(mockSupabase, 'doc-private-123', 'attacker-id', false);
      expect(result).toBeNull();
    });

    it('prevents attacker from modifying document belonging to another user', async () => {
      const mockSupabase: any = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: 'doc-private-123',
                  user_id: 'victim-user-id',
                  is_public: false,
                  status: 'published',
                },
                error: null,
              }),
            }),
          }),
        }),
      };

      await expect(
        updateDocument(mockSupabase, 'doc-private-123', { title: 'Overwritten by Attacker' }, 'attacker-id', false)
      ).rejects.toThrow('FORBIDDEN');
    });

    it('prevents attacker from deleting document belonging to another user', async () => {
      const mockSupabase: any = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: 'doc-private-123',
                  user_id: 'victim-user-id',
                  is_public: false,
                  status: 'published',
                },
                error: null,
              }),
            }),
          }),
        }),
      };

      await expect(
        deleteDocument(mockSupabase, 'doc-private-123', 'attacker-id', false)
      ).rejects.toThrow('FORBIDDEN');
    });
  });

  describe('Mass Assignment Defense', () => {
    it('strips privileged fields (role, id, email) when updating user profile', async () => {
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'regular-user-id',
                email: 'user@example.com',
                full_name: 'Updated Name',
                role: 'user', // Remains user
              },
              error: null,
            }),
          }),
        }),
      });

      const mockSupabase: any = {
        from: vi.fn().mockReturnValue({
          update: updateMock,
        }),
      };

      // Attacker attempts mass assignment payload attempting role elevation to admin
      const maliciousPayload: any = {
        full_name: 'Updated Name',
        role: 'admin',
        id: 'new-id',
        email: 'attacker@evil.com',
      };

      await updateUserProfile(mockSupabase, 'regular-user-id', maliciousPayload);

      // Verify that the database update only received full_name and updated_at, NOT role or id or email
      expect(updateMock).toHaveBeenCalledWith(
        expect.not.objectContaining({
          role: 'admin',
          id: 'new-id',
          email: 'attacker@evil.com',
        })
      );
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          full_name: 'Updated Name',
        })
      );
    });

    it('strips user_id, status, and likes_count when updating document metadata', async () => {
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'doc-1',
                user_id: 'owner-id',
                title: 'New Title',
                status: 'published',
                likes_count: 0,
              },
              error: null,
            }),
          }),
        }),
      });

      const mockSupabase: any = {
        from: vi.fn().mockImplementation((table: string) => ({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'doc-1', user_id: 'owner-id', is_public: false, status: 'published' },
                error: null,
              }),
            }),
          }),
          update: updateMock,
        })),
      };

      // Attacker passes privileged fields in update
      const maliciousUpdate: any = {
        title: 'New Title',
        user_id: 'attacker-id',
        likes_count: 999999,
        status: 'published',
      };

      await updateDocument(mockSupabase, 'doc-1', maliciousUpdate, 'owner-id', false);

      expect(updateMock).toHaveBeenCalledWith(
        expect.not.objectContaining({
          user_id: 'attacker-id',
          likes_count: 999999,
        })
      );
    });
  });

  describe('Service Role Key Isolation', () => {
    it('throws fatal error if createAdminClient is ever invoked in browser context', () => {
      // Simulate browser window object
      (global as any).window = {};

      expect(() => {
        createAdminClient();
      }).toThrow('FATAL SECURITY ERROR: createAdminClient cannot be invoked on the client side.');

      delete (global as any).window;
    });

    it('confirms server-only variables are not prefixed with NEXT_PUBLIC_', () => {
      // Verify SUPABASE_SERVICE_ROLE_KEY is server-only
      const envKeys = Object.keys(process.env);
      const publicServiceRole = envKeys.find((k) => k.includes('PUBLIC') && k.includes('SERVICE_ROLE'));
      expect(publicServiceRole).toBeUndefined();
    });
  });
});
