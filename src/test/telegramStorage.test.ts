import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isPdfBuffer,
  isChatIdAllowed,
  registerTelegramUpload,
  createAdminDirectUpload,
  approveAndPublishUpload,
  unpublishDocument,
  deleteDocumentEverywhere,
  reopenUpload,
} from '../lib/services/telegramService';
import { telegramClient } from '../lib/telegram/client';
import { checkTelegramUploadEligibility, TELEGRAM_LIMITS } from '../lib/telegram/limits';

// Mock getAdminClient
vi.mock('../lib/supabase/admin', () => {
  return {
    getAdminClient: vi.fn(),
  };
});

import { getAdminClient } from '../lib/supabase/admin';

describe('OpenShelf — Telegram Central PDF Storage & Publishing System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. PDF Buffer & Header Validation (%PDF-)', () => {
    it('detects valid PDF %PDF- magic bytes header', () => {
      const validPdf = Buffer.from('%PDF-1.7\nSample pdf content\n%%EOF');
      expect(isPdfBuffer(validPdf)).toBe(true);
    });

    it('rejects invalid, corrupted, or non-PDF headers', () => {
      expect(isPdfBuffer(Buffer.from('GIF89a...'))).toBe(false);
      expect(isPdfBuffer(Buffer.from('PK\x03\x04...'))).toBe(false);
      expect(isPdfBuffer(Buffer.from('<html><body>Not a PDF</body></html>'))).toBe(false);
      expect(isPdfBuffer(Buffer.from(''))).toBe(false);
      expect(isPdfBuffer(Buffer.from('%PD'))).toBe(false);
    });
  });

  describe('2. Telegram Upload Limits & Eligibility', () => {
    it('enforces 20MB limit for cloud Bot API downloads', () => {
      expect(TELEGRAM_LIMITS.CLOUD_BOT_API_DOWNLOAD_MAX_BYTES).toBe(20 * 1024 * 1024);
    });

    it('validates upload eligibility under Cloud API vs Local Server', () => {
      const smallFile = 10 * 1024 * 1024;
      const mediumFile = 45 * 1024 * 1024;
      const largeFile = 60 * 1024 * 1024;

      expect(checkTelegramUploadEligibility(smallFile, false).eligible).toBe(true);
      expect(checkTelegramUploadEligibility(mediumFile, false).eligible).toBe(true);
      expect(checkTelegramUploadEligibility(largeFile, false).eligible).toBe(false);

      // Local API server supports up to 2,000 MB
      expect(checkTelegramUploadEligibility(largeFile, true).eligible).toBe(true);
    });
  });

  describe('3. Chat ID Allowlist & Ingestion Security', () => {
    it('allows authorized chat IDs and rejects unauthorized IDs', () => {
      process.env.TELEGRAM_ALLOWED_CHAT_IDS = '-1001234567890,-1009876543210';

      expect(isChatIdAllowed('-1001234567890')).toBe(true);
      expect(isChatIdAllowed(-1001234567890)).toBe(true);
      expect(isChatIdAllowed('-1009876543210')).toBe(true);
      expect(isChatIdAllowed('-9999999999999')).toBe(false);
      expect(isChatIdAllowed('unauthorized_hacker_chat')).toBe(false);
    });
  });

  describe('4. Ingestion, Metadata Parsing & Idempotency', () => {
    it('derives clean title from filename when caption is empty', async () => {
      let insertedPayload: any = null;
      const mockAdminClient = {
        from: vi.fn((table: string) => {
          if (table === 'telegram_uploads') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null }),
                  })),
                  maybeSingle: vi.fn().mockResolvedValue({ data: null }),
                })),
              })),
              insert: vi.fn((payload) => {
                insertedPayload = payload;
                return {
                  select: vi.fn(() => ({
                    single: vi.fn().mockResolvedValue({
                      data: { id: 'upload-uuid-1', ...payload },
                      error: null,
                    }),
                  })),
                };
              }),
            };
          }
          if (table === 'admin_activity_logs') {
            return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) };
          }
          return {};
        }),
      };

      (getAdminClient as any).mockReturnValue(mockAdminClient);

      const result = await registerTelegramUpload({
        chatId: -1001234567890,
        messageId: 501,
        fileId: 'tg_file_001',
        fileUniqueId: 'unique_001',
        fileName: 'Advanced_Operating_Systems-2024.pdf',
        fileSize: 4500000,
        mimeType: 'application/pdf',
        caption: '',
      });

      expect(result.success).toBe(true);
      expect(insertedPayload).toBeDefined();
      expect(insertedPayload.title).toBe('Advanced Operating Systems 2024');
      expect(insertedPayload.source_type).toBe('telegram');
      expect(insertedPayload.is_duplicate).toBe(false);
    });

    it('handles exact webhook retries idempotently without duplicate inserts', async () => {
      const existingUpload = {
        id: 'existing-upload-100',
        telegram_chat_id: -1001234567890,
        telegram_message_id: 777,
        telegram_file_unique_id: 'unique_retry_1',
        title: 'Retry Test Document',
      };

      const mockAdminClient = {
        from: vi.fn((table: string) => {
          if (table === 'telegram_uploads') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue({ data: existingUpload }),
                  })),
                })),
              })),
            };
          }
          return {};
        }),
      };

      (getAdminClient as any).mockReturnValue(mockAdminClient);

      const result = await registerTelegramUpload({
        chatId: -1001234567890,
        messageId: 777,
        fileId: 'tg_file_retry',
        fileUniqueId: 'unique_retry_1',
        fileName: 'Retry_Test.pdf',
        fileSize: 2000000,
        mimeType: 'application/pdf',
      });

      expect(result.success).toBe(true);
      expect(result.isDuplicate).toBe(true);
      expect(result.upload?.id).toBe('existing-upload-100');
    });

    it('flags duplicate file content with is_duplicate = true and links duplicate_of_id', async () => {
      let insertedPayload: any = null;
      const mockAdminClient = {
        from: vi.fn((table: string) => {
          if (table === 'telegram_uploads') {
            return {
              select: vi.fn((fields: string) => {
                return {
                  eq: vi.fn((field1: string) => {
                    if (field1 === 'telegram_chat_id') {
                      return {
                        eq: vi.fn(() => ({
                          maybeSingle: vi.fn().mockResolvedValue({ data: null }), // different message
                        })),
                      };
                    }
                    if (field1 === 'telegram_file_unique_id') {
                      return {
                        maybeSingle: vi.fn().mockResolvedValue({
                          data: { id: 'original-upload-uuid', title: 'Original Doc' },
                        }),
                      };
                    }
                    return { maybeSingle: vi.fn().mockResolvedValue({ data: null }) };
                  }),
                };
              }),
              insert: vi.fn((payload) => {
                insertedPayload = payload;
                return {
                  select: vi.fn(() => ({
                    single: vi.fn().mockResolvedValue({
                      data: { id: 'new-upload-uuid', ...payload },
                      error: null,
                    }),
                  })),
                };
              }),
            };
          }
          if (table === 'admin_activity_logs') {
            return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) };
          }
          return {};
        }),
      };

      (getAdminClient as any).mockReturnValue(mockAdminClient);

      const result = await registerTelegramUpload({
        chatId: -1001234567890,
        messageId: 888, // new message
        fileId: 'tg_file_forwarded',
        fileUniqueId: 'unique_same_content_hash',
        fileName: 'Duplicate_Book.pdf',
        fileSize: 1500000,
        mimeType: 'application/pdf',
      });

      expect(result.success).toBe(true);
      expect(insertedPayload.is_duplicate).toBe(true);
      expect(insertedPayload.duplicate_of_id).toBe('original-upload-uuid');
    });

    it('marks files exceeding Telegram Cloud 20MB limit as processing_failed', async () => {
      let insertedPayload: any = null;
      const mockAdminClient = {
        from: vi.fn((table: string) => {
          if (table === 'telegram_uploads') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null }),
                  })),
                  maybeSingle: vi.fn().mockResolvedValue({ data: null }),
                })),
              })),
              insert: vi.fn((payload) => {
                insertedPayload = payload;
                return {
                  select: vi.fn(() => ({
                    single: vi.fn().mockResolvedValue({
                      data: { id: 'oversized-upload-uuid', ...payload },
                      error: null,
                    }),
                  })),
                };
              }),
            };
          }
          if (table === 'admin_activity_logs') {
            return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) };
          }
          return {};
        }),
      };

      (getAdminClient as any).mockReturnValue(mockAdminClient);

      const result = await registerTelegramUpload({
        chatId: -1001234567890,
        messageId: 999,
        fileId: 'tg_oversized',
        fileUniqueId: 'unique_oversized',
        fileName: 'Gigantic_Textbook.pdf',
        fileSize: 35 * 1024 * 1024, // 35 MB (> 20 MB)
        mimeType: 'application/pdf',
      });

      expect(result.success).toBe(true);
      expect(insertedPayload.status).toBe('processing_failed');
      expect(insertedPayload.rejection_reason).toContain('exceeds Telegram Cloud Bot API 20MB limit');
    });
  });

  describe('5. Direct PDF Upload from Admin Panel', () => {
    it('rejects direct uploads without valid %PDF- magic bytes', async () => {
      const fakeBuffer = Buffer.from('Not a real PDF document');
      const result = await createAdminDirectUpload(
        {
          fileBuffer: fakeBuffer,
          fileName: 'fake.pdf',
          title: 'Fake Document',
        },
        'admin_user'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('%PDF- header');
    });

    it('uploads valid PDF directly to Telegram and records source_type = admin_upload', async () => {
      let insertedPayload: any = null;
      const validPdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');

      const mockAdminClient = {
        from: vi.fn((table: string) => {
          if (table === 'telegram_uploads') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null }),
                })),
              })),
              insert: vi.fn((payload) => {
                insertedPayload = payload;
                return {
                  select: vi.fn(() => ({
                    single: vi.fn().mockResolvedValue({
                      data: { id: 'admin-upload-uuid', ...payload },
                      error: null,
                    }),
                  })),
                };
              }),
            };
          }
          if (table === 'admin_activity_logs') {
            return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) };
          }
          return {};
        }),
      };

      (getAdminClient as any).mockReturnValue(mockAdminClient);

      const result = await createAdminDirectUpload(
        {
          fileBuffer: validPdfBuffer,
          fileName: 'Lecture_Notes.pdf',
          title: 'Advanced Computer Networks',
          description: 'Comprehensive network architecture guide',
          categoryName: 'Computer Science',
          author: 'Prof. Tanenbaum',
          publicationYear: 2024,
        },
        'superadmin'
      );

      expect(result.success).toBe(true);
      expect(insertedPayload).toBeDefined();
      expect(insertedPayload.source_type).toBe('admin_upload');
      expect(insertedPayload.title).toBe('Advanced Computer Networks');
      expect(insertedPayload.author).toBe('Prof. Tanenbaum');
      expect(insertedPayload.status).toBe('pending');
    });
  });

  describe('6. Approval & Publishing Workflow', () => {
    it('copies all Telegram references into the published documents record', async () => {
      const pendingUpload = {
        id: 'upload-to-approve',
        title: 'Database Internals',
        description: 'B-Trees and LSM Trees',
        original_filename: 'db_internals.pdf',
        file_size: 1048576,
        file_hash: 'abcdef1234567890',
        telegram_file_id: 'tg_file_ref_99',
        telegram_file_unique_id: 'unique_hash_99',
        telegram_chat_id: -1001234567890,
        telegram_message_id: 1234,
        source_type: 'telegram',
        status: 'pending',
        category_name: 'Computer Science',
        tags: ['storage', 'databases'],
      };

      let insertedDocument: any = null;
      let updatedUpload: any = null;

      const mockAdminClient = {
        from: vi.fn((table: string) => {
          if (table === 'telegram_uploads') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: pendingUpload }),
                })),
              })),
              update: vi.fn((payload) => {
                updatedUpload = payload;
                return {
                  eq: vi.fn(() => ({
                    select: vi.fn(() => ({
                      single: vi.fn().mockResolvedValue({ data: { ...pendingUpload, ...payload }, error: null }),
                    })),
                  })),
                };
              }),
            };
          }
          if (table === 'documents') {
            return {
              insert: vi.fn((payload) => {
                insertedDocument = payload;
                return {
                  select: vi.fn(() => ({
                    single: vi.fn().mockResolvedValue({ data: { id: 'doc-uuid-1', ...payload }, error: null }),
                  })),
                };
              }),
            };
          }
          if (table === 'admin_activity_logs') {
            return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) };
          }
          return {};
        }),
      };

      (getAdminClient as any).mockReturnValue(mockAdminClient);

      const result = await approveAndPublishUpload('upload-to-approve', 'moderator_steve');

      expect(result.success).toBe(true);
      expect(insertedDocument).toBeDefined();
      expect(insertedDocument.storage_type).toBe('telegram');
      expect(insertedDocument.storage_file_id).toBe('tg_file_ref_99');
      expect(insertedDocument.telegram_chat_id).toBe(-1001234567890);
      expect(insertedDocument.telegram_message_id).toBe(1234);
      expect(insertedDocument.telegram_file_unique_id).toBe('unique_hash_99');
      expect(insertedDocument.is_public).toBe(true);
      expect(insertedDocument.status).toBe('published');
      expect(insertedDocument.is_deleted).toBe(false);

      expect(updatedUpload.status).toBe('published');
      expect(updatedUpload.reviewed_by).toBe('moderator_steve');
    });
  });

  describe('7. Unpublish & Reopen Lifecycle', () => {
    it('unpublishes a published document, immediately hiding it from the public feed', async () => {
      let docUpdates: any = null;
      let uploadUpdates: any = null;

      const mockAdminClient = {
        from: vi.fn((table: string) => {
          if (table === 'documents') {
            return {
              update: vi.fn((payload) => {
                docUpdates = payload;
                return { eq: vi.fn().mockResolvedValue({ error: null }) };
              }),
            };
          }
          if (table === 'telegram_uploads') {
            return {
              update: vi.fn((payload) => {
                uploadUpdates = payload;
                return { eq: vi.fn().mockResolvedValue({ error: null }) };
              }),
            };
          }
          if (table === 'admin_activity_logs') {
            return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) };
          }
          return {};
        }),
      };

      (getAdminClient as any).mockReturnValue(mockAdminClient);

      const res = await unpublishDocument('doc-to-unpublish', 'admin');
      expect(res.success).toBe(true);
      expect(docUpdates.is_public).toBe(false);
      expect(docUpdates.status).toBe('draft');
      expect(uploadUpdates.status).toBe('unpublished');
    });

    it('reopens an unpublished or rejected upload back to pending review', async () => {
      let reopenedUpload: any = null;
      const mockAdminClient = {
        from: vi.fn((table: string) => {
          if (table === 'telegram_uploads') {
            return {
              update: vi.fn((payload) => {
                reopenedUpload = payload;
                return {
                  eq: vi.fn(() => ({
                    select: vi.fn(() => ({
                      single: vi.fn().mockResolvedValue({ data: { id: 'upload-1', ...payload }, error: null }),
                    })),
                  })),
                };
              }),
            };
          }
          if (table === 'admin_activity_logs') {
            return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) };
          }
          return {};
        }),
      };

      (getAdminClient as any).mockReturnValue(mockAdminClient);

      const res = await reopenUpload('upload-1', 'admin');
      expect(res.success).toBe(true);
      expect(reopenedUpload.status).toBe('pending');
      expect(reopenedUpload.rejection_reason).toBeNull();
    });
  });

  describe('8. Delete Everywhere (Telegram Message + Database)', () => {
    it('deletes Telegram message and archives document in Supabase', async () => {
      const doc = {
        id: 'doc-delete-1',
        title: 'Copyright Infringing Doc',
        telegram_chat_id: -1001234567890,
        telegram_message_id: 4321,
      };

      let docArchivedPayload: any = null;
      const deleteMessageSpy = vi.spyOn(telegramClient, 'deleteMessage').mockResolvedValue({ success: true });

      const mockAdminClient = {
        from: vi.fn((table: string) => {
          if (table === 'documents') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: doc, error: null }),
                })),
              })),
              update: vi.fn((payload) => {
                docArchivedPayload = payload;
                return { eq: vi.fn().mockResolvedValue({ error: null }) };
              }),
            };
          }
          if (table === 'telegram_uploads') {
            return {
              update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
            };
          }
          if (table === 'admin_activity_logs') {
            return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) };
          }
          return {};
        }),
      };

      (getAdminClient as any).mockReturnValue(mockAdminClient);

      const result = await deleteDocumentEverywhere('doc-delete-1', 'superadmin');

      expect(result.success).toBe(true);
      expect(result.telegramDeleted).toBe(true);
      expect(deleteMessageSpy).toHaveBeenCalledWith(-1001234567890, 4321);

      expect(docArchivedPayload.is_deleted).toBe(true);
      expect(docArchivedPayload.status).toBe('archived');
      expect(docArchivedPayload.is_public).toBe(false);
      expect(docArchivedPayload.telegram_deleted).toBe(true);
    });

    it('gracefully handles Telegram deletion failure and still records soft delete in database', async () => {
      const doc = {
        id: 'doc-old-1',
        title: 'Very Old Document',
        telegram_chat_id: -1001234567890,
        telegram_message_id: 111,
      };

      let docArchivedPayload: any = null;
      vi.spyOn(telegramClient, 'deleteMessage').mockResolvedValue({
        success: false,
        error: 'Bad Request: message can\'t be deleted (older than 48 hours)',
      });

      const mockAdminClient = {
        from: vi.fn((table: string) => {
          if (table === 'documents') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: doc, error: null }),
                })),
              })),
              update: vi.fn((payload) => {
                docArchivedPayload = payload;
                return { eq: vi.fn().mockResolvedValue({ error: null }) };
              }),
            };
          }
          if (table === 'telegram_uploads') {
            return {
              update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
            };
          }
          if (table === 'admin_activity_logs') {
            return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) };
          }
          return {};
        }),
      };

      (getAdminClient as any).mockReturnValue(mockAdminClient);

      const result = await deleteDocumentEverywhere('doc-old-1', 'superadmin');

      expect(result.success).toBe(true);
      expect(result.telegramDeleted).toBe(false);
      expect(result.error).toContain('older than 48 hours');

      expect(docArchivedPayload.is_deleted).toBe(true);
      expect(docArchivedPayload.telegram_deleted).toBe(false);
    });
  });
});
