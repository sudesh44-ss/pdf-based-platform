import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  hashAdminPassword,
  verifyAdminPassword,
  hashSessionToken,
  verifyAdminSessionToken,
} from '../lib/auth/adminAuth';
import {
  isChatIdAllowed,
  registerTelegramUpload,
  approveAndPublishUpload,
  rejectUpload,
  reopenUpload,
  unpublishDocument,
} from '../lib/services/telegramService';
import { getDocuments, getDocumentById } from '../lib/services/documentService';

// Mock getAdminClient for isolated service testing
vi.mock('../lib/supabase/admin', () => {
  return {
    getAdminClient: vi.fn(),
  };
});

import { getAdminClient } from '../lib/supabase/admin';

describe('SmartPDF Admin & Telegram Approval Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Admin Separate Authentication & Password Hashing', () => {
    it('generates a valid scrypt hash and verifies matching password', () => {
      const password = 'SuperSecretAdminPassword123!';
      const hash = hashAdminPassword(password);

      expect(hash).toMatch(/^scrypt:[0-9a-f]{32}:[0-9a-f]{128}$/);
      expect(verifyAdminPassword(password, hash)).toBe(true);
      expect(verifyAdminPassword('WrongPassword', hash)).toBe(false);
    });

    it('rejects verification if hash is missing or malformed', () => {
      expect(verifyAdminPassword('password', undefined)).toBe(false);
      expect(verifyAdminPassword('password', '')).toBe(false);
      expect(verifyAdminPassword('password', 'invalid_format')).toBe(false);
      expect(verifyAdminPassword('password', 'scrypt:salt:badlength')).toBe(false);
    });

    it('generates HMAC token hashes consistently', () => {
      const token = 'abcdef1234567890abcdef1234567890';
      const hash1 = hashSessionToken(token);
      const hash2 = hashSessionToken(token);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it('rejects admin session verification when token is null or expired', async () => {
      const emptyResult = await verifyAdminSessionToken(null);
      expect(emptyResult.valid).toBe(false);

      // Mock database returning expired session
      (getAdminClient as any).mockReturnValue({
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: 'session-123',
                  username: 'admin',
                  expires_at: new Date(Date.now() - 3600000).toISOString(), // 1 hr ago
                  revoked_at: null,
                },
                error: null,
              }),
            }),
          }),
        }),
      });

      const expiredResult = await verifyAdminSessionToken('some-token');
      expect(expiredResult.valid).toBe(false);
    });

    it('rejects admin session verification when session is revoked', async () => {
      (getAdminClient as any).mockReturnValue({
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: 'session-456',
                  username: 'admin',
                  expires_at: new Date(Date.now() + 3600000).toISOString(),
                  revoked_at: new Date().toISOString(), // Revoked
                },
                error: null,
              }),
            }),
          }),
        }),
      });

      const revokedResult = await verifyAdminSessionToken('some-token');
      expect(revokedResult.valid).toBe(false);
    });
  });

  describe('Telegram Chat Allowlist & PDF Ingestion Rules', () => {
    it('verifies chat IDs against TELEGRAM_ALLOWED_CHAT_IDS', () => {
      process.env.TELEGRAM_ALLOWED_CHAT_IDS = '-1001234567890,-1009876543210';

      expect(isChatIdAllowed('-1001234567890')).toBe(true);
      expect(isChatIdAllowed(-1001234567890)).toBe(true);
      expect(isChatIdAllowed('-1009876543210')).toBe(true);
      expect(isChatIdAllowed('-1009999999999')).toBe(false);
      expect(isChatIdAllowed('123456')).toBe(false);
    });

    it('flags uploads exceeding Telegram 20MB Cloud API limit as processing_failed', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: () => ({
          single: async () => ({
            data: { id: 'up-1', status: 'processing_failed' },
            error: null,
          }),
        }),
      });

      (getAdminClient as any).mockReturnValue({
        from: (table: string) => {
          if (table === 'telegram_uploads') {
            return {
              select: () => ({
                or: () => ({
                  maybeSingle: async () => ({ data: null, error: null }), // No duplicates
                }),
              }),
              insert: mockInsert,
            };
          }
          if (table === 'admin_activity_logs') {
            return { insert: vi.fn() };
          }
          return {};
        },
      });

      const oversizedBytes = 25 * 1024 * 1024; // 25 MB
      const result = await registerTelegramUpload({
        chatId: -1001234567890,
        messageId: 101,
        fileId: 'tg_file_oversized',
        fileUniqueId: 'uniq_oversized',
        fileName: 'huge_handbook.pdf',
        fileSize: oversizedBytes,
        mimeType: 'application/pdf',
      });

      expect(result.success).toBe(true);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'processing_failed',
          rejection_reason: expect.stringContaining('exceeds Telegram Cloud Bot API 20MB limit'),
        })
      );
    });

    it('detects duplicate Telegram webhook messages idempotently', async () => {
      (getAdminClient as any).mockReturnValue({
        from: (table: string) => {
          if (table === 'telegram_uploads') {
            return {
              select: () => ({
                or: () => ({
                  maybeSingle: async () => ({
                    data: { id: 'existing-upload-123', telegram_file_id: 'tg_1' },
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {};
        },
      });

      const result = await registerTelegramUpload({
        chatId: -1001234567890,
        messageId: 999,
        fileId: 'tg_1',
        fileUniqueId: 'uniq_1',
        fileName: 'existing.pdf',
        fileSize: 1024000,
        mimeType: 'application/pdf',
      });

      expect(result.success).toBe(true);
      expect(result.isDuplicate).toBe(true);
      expect(result.upload?.id).toBe('existing-upload-123');
    });
  });

  describe('PDF Moderation & Publication Workflow', () => {
    it('approves a pending upload and publishes it as a verified public document', async () => {
      const mockUpload = {
        id: 'up-approve-1',
        title: 'Advanced Computer Networks',
        description: 'Comprehensive graduate study guide.',
        original_filename: 'networks.pdf',
        file_size: 4500000,
        telegram_file_id: 'tg_file_net',
        category_name: 'Computer Science',
        tags: ['networking', 'protocols'],
        status: 'pending',
        document_id: null,
      };

      const mockDocInsert = vi.fn().mockReturnValue({
        select: () => ({
          single: async () => ({
            data: { id: 'doc-net-1', title: mockUpload.title, status: 'published', is_public: true },
            error: null,
          }),
        }),
      });

      const mockUploadUpdate = vi.fn().mockReturnValue({
        eq: () => ({
          select: () => ({
            single: async () => ({
              data: { ...mockUpload, status: 'published', document_id: 'doc-net-1' },
              error: null,
            }),
          }),
        }),
      });

      (getAdminClient as any).mockReturnValue({
        from: (table: string) => {
          if (table === 'telegram_uploads') {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: mockUpload, error: null }),
                }),
              }),
              update: mockUploadUpdate,
            };
          }
          if (table === 'documents') {
            return {
              insert: mockDocInsert,
            };
          }
          if (table === 'admin_activity_logs') {
            return { insert: vi.fn().mockResolvedValue({ error: null }) };
          }
          return {};
        },
      });

      const result = await approveAndPublishUpload('up-approve-1', 'lead_admin');

      expect(result.success).toBe(true);
      expect(result.upload?.status).toBe('published');
      expect(result.document?.status).toBe('published');
      expect(mockDocInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Advanced Computer Networks',
          storage_type: 'telegram',
          storage_file_id: 'tg_file_net',
          is_public: true,
          status: 'published',
        })
      );
    });

    it('rejects an upload with reason and marks it rejected in database', async () => {
      const mockUpload = {
        id: 'up-reject-1',
        title: 'Corrupted File',
        status: 'pending',
        document_id: null,
      };

      const mockUploadUpdate = vi.fn().mockReturnValue({
        eq: () => ({
          select: () => ({
            single: async () => ({
              data: { ...mockUpload, status: 'rejected', rejection_reason: 'Corrupted pages' },
              error: null,
            }),
          }),
        }),
      });

      (getAdminClient as any).mockReturnValue({
        from: (table: string) => {
          if (table === 'telegram_uploads') {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: mockUpload, error: null }),
                }),
              }),
              update: mockUploadUpdate,
            };
          }
          if (table === 'admin_activity_logs') {
            return { insert: vi.fn().mockResolvedValue({ error: null }) };
          }
          return {};
        },
      });

      const result = await rejectUpload('up-reject-1', 'Corrupted pages', 'lead_admin');
      expect(result.success).toBe(true);
      expect(result.upload?.status).toBe('rejected');
    });

    it('reopens a rejected upload back into pending review state', async () => {
      const mockReopenUpdate = vi.fn().mockReturnValue({
        eq: () => ({
          select: () => ({
            single: async () => ({
              data: { id: 'up-reopen-1', status: 'pending', rejection_reason: null },
              error: null,
            }),
          }),
        }),
      });

      (getAdminClient as any).mockReturnValue({
        from: (table: string) => {
          if (table === 'telegram_uploads') {
            return {
              update: mockReopenUpdate,
            };
          }
          if (table === 'admin_activity_logs') {
            return { insert: vi.fn().mockResolvedValue({ error: null }) };
          }
          return {};
        },
      });

      const result = await reopenUpload('up-reopen-1', 'lead_admin');
      expect(result.success).toBe(true);
      expect(result.upload?.status).toBe('pending');
      expect(mockReopenUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'pending',
          rejection_reason: null,
        })
      );
    });

    it('unpublishes a published document and hides it from public users', async () => {
      const mockDocUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      const mockUploadUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      (getAdminClient as any).mockReturnValue({
        from: (table: string) => {
          if (table === 'documents') {
            return {
              update: mockDocUpdate,
            };
          }
          if (table === 'telegram_uploads') {
            return {
              update: mockUploadUpdate,
            };
          }
          if (table === 'admin_activity_logs') {
            return { insert: vi.fn().mockResolvedValue({ error: null }) };
          }
          return {};
        },
      });

      const result = await unpublishDocument('doc-to-hide', 'lead_admin');
      expect(result.success).toBe(true);
      expect(mockDocUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          is_public: false,
          status: 'draft',
        })
      );
    });
  });

  describe('Multi-User Publication & Access Isolation', () => {
    it('enforces that public queries only return approved and published documents', async () => {
      const mockEq3 = vi.fn().mockReturnValue({
        order: () => ({
          range: async () => ({
            data: [
              { id: 'pub-1', title: 'Calculus IV', is_public: true, status: 'published', is_trash: false },
            ],
            count: 1,
            error: null,
          }),
        }),
      });

      const mockEq2 = vi.fn().mockReturnValue({ eq: mockEq3 });
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: mockEq1,
          }),
        }),
      } as any;

      const result = await getDocuments(mockSupabase, { isPublic: true });
      expect(result.documents).toHaveLength(1);
      expect(mockEq1).toHaveBeenCalledWith('is_public', true);
      expect(mockEq2).toHaveBeenCalledWith('status', 'published');
      expect(mockEq3).toHaveBeenCalledWith('is_trash', false);
    });

    it('prevents non-owners from retrieving unpublished or draft documents', async () => {
      const mockSupabase = {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: 'draft-doc-1',
                  user_id: 'user-author-id',
                  is_public: false,
                  status: 'draft',
                  is_trash: false,
                },
                error: null,
              }),
            }),
          }),
        }),
      } as any;

      // User B tries to view User A's unpublished draft
      const result = await getDocumentById(mockSupabase, 'draft-doc-1', 'user-intruder-id', false);
      expect(result).toBeNull();
    });
  });
});
