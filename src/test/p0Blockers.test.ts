// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as handleAdminUpload } from '../app/api/admin/uploads/route';
import { POST as handleTelegramWebhook } from '../app/api/telegram/webhook/route';
import { ADMIN_DIRECT_UPLOAD_LIMITS } from '../lib/telegram/limits';
import { telegramClient } from '../lib/telegram/client';

// Mock admin session
vi.mock('../lib/auth/adminAuth', () => ({
  getVerifiedAdminSession: vi.fn().mockResolvedValue({ valid: true, username: 'admin' }),
  logAdminActivity: vi.fn().mockResolvedValue(true),
}));

// Mock getAdminClient
vi.mock('../lib/supabase/admin', () => ({
  getAdminClient: vi.fn(),
}));

import { getAdminClient } from '../lib/supabase/admin';

describe('P0 Production Blockers Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('P0-1: Admin Direct Upload Limits & Validation', () => {
    it('defines 4 MB limit for direct browser uploads', () => {
      expect(ADMIN_DIRECT_UPLOAD_LIMITS.MAX_FILE_BYTES).toBe(4 * 1024 * 1024);
      expect(ADMIN_DIRECT_UPLOAD_LIMITS.MAX_REQUEST_BYTES).toBe(4.5 * 1024 * 1024);
    });

    it('rejects uploads missing the file field with HTTP 400', async () => {
      const formData = new FormData();
      formData.append('title', 'No File Attached');

      const req = new Request('http://localhost:3000/api/admin/uploads', {
        method: 'POST',
        body: formData,
      });

      const res = await handleAdminUpload(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('INVALID_INPUT');
    });

    it('rejects requests with Content-Length exceeding 4.5 MB with HTTP 413', async () => {
      const formData = new FormData();
      const fakePdf = new Blob(['%PDF-1.4\n...'], { type: 'application/pdf' });
      formData.append('file', fakePdf, 'doc.pdf');

      const req = new Request('http://localhost:3000/api/admin/uploads', {
        method: 'POST',
        headers: {
          'content-length': String(5 * 1024 * 1024), // 5 MB
        },
        body: formData,
      });

      const res = await handleAdminUpload(req);
      expect(res.status).toBe(413);
      const json = await res.json();
      expect(json.error.code).toBe('PAYLOAD_TOO_LARGE');
    });

    it('rejects files exceeding 4 MB with HTTP 413 and telegram guidance', async () => {
      const largeContent = Buffer.alloc(4.2 * 1024 * 1024);
      largeContent.write('%PDF-1.7\n');
      const file = new File([largeContent], 'heavy-book.pdf', { type: 'application/pdf' });

      const formData = new FormData();
      formData.append('file', file);

      const req = new Request('http://localhost:3000/api/admin/uploads', {
        method: 'POST',
        body: formData,
      });

      const res = await handleAdminUpload(req);
      expect(res.status).toBe(413);
      const json = await res.json();
      expect(json.error.code).toBe('PAYLOAD_TOO_LARGE');
      expect(json.error.message).toContain('Telegram group');
    });

    it('rejects non-.pdf extension with HTTP 400', async () => {
      const file = new File(['%PDF-1.4\nfake'], 'malicious.exe', { type: 'application/pdf' });
      const formData = new FormData();
      formData.append('file', file);

      const req = new Request('http://localhost:3000/api/admin/uploads', {
        method: 'POST',
        body: formData,
      });

      const res = await handleAdminUpload(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('INVALID_EXTENSION');
    });

    it('rejects non-PDF MIME type with HTTP 400', async () => {
      const file = new File(['%PDF-1.4\nfake'], 'test.pdf', { type: 'image/png' });
      const formData = new FormData();
      formData.append('file', file);

      const req = new Request('http://localhost:3000/api/admin/uploads', {
        method: 'POST',
        body: formData,
      });

      const res = await handleAdminUpload(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('INVALID_MIME_TYPE');
    });

    it('rejects corrupt file missing %PDF- magic signature with HTTP 400', async () => {
      const file = new File(['NOT A REAL PDF FILE HEADER'], 'fake.pdf', { type: 'application/pdf' });
      const formData = new FormData();
      formData.append('file', file);

      const req = new Request('http://localhost:3000/api/admin/uploads', {
        method: 'POST',
        body: formData,
      });

      const res = await handleAdminUpload(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('INVALID_PDF_SIGNATURE');
    });

    it('handles Telegram upload failure without creating database records', async () => {
      const validPdfBytes = Buffer.from('%PDF-1.4\nvalid content\n%%EOF');
      const file = new File([validPdfBytes], 'valid.pdf', { type: 'application/pdf' });
      const formData = new FormData();
      formData.append('file', file);

      vi.spyOn(telegramClient, 'uploadPdf').mockResolvedValueOnce({
        success: false,
        error: 'Telegram API timeout error (504)',
      });

      const mockDb = { from: vi.fn() };
      (getAdminClient as any).mockReturnValue(mockDb);

      const req = new Request('http://localhost:3000/api/admin/uploads', {
        method: 'POST',
        body: formData,
      });

      const res = await handleAdminUpload(req);
      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.error.code).toBe('UPLOAD_FAILED');
      // DB insert was NOT called because Telegram upload failed
      expect(mockDb.from).not.toHaveBeenCalledWith('telegram_uploads');
    });

    it('successfully processes valid PDF <= 4 MB', async () => {
      const validPdfBytes = Buffer.from('%PDF-1.7\nvalid content\n%%EOF');
      const file = new File([validPdfBytes], 'Lecture_Notes.pdf', { type: 'application/pdf' });
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', 'Operating Systems');

      vi.spyOn(telegramClient, 'uploadPdf').mockResolvedValueOnce({
        success: true,
        messageId: 5555,
        fileId: 'tg_file_555',
        fileUniqueId: 'unique_555',
        fileSize: validPdfBytes.length,
        sha256: 'dummy_hash',
      });

      let insertedData: any = null;
      const mockDb = {
        from: vi.fn((table: string) => {
          if (table === 'telegram_uploads') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null }),
                })),
              })),
              insert: vi.fn((data) => {
                insertedData = data;
                return {
                  select: vi.fn(() => ({
                    single: vi.fn().mockResolvedValue({
                      data: { id: 'new-upload-uuid', ...data },
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
      (getAdminClient as any).mockReturnValue(mockDb);

      const req = new Request('http://localhost:3000/api/admin/uploads', {
        method: 'POST',
        body: formData,
      });

      const res = await handleAdminUpload(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(insertedData.source_type).toBe('admin_upload');
      expect(insertedData.telegram_message_id).toBe(5555);
    });
  });

  describe('P0-2: Telegram Webhook Ingestion & Idempotency', () => {
    it('rejects updates with incorrect secret token with HTTP 401', async () => {
      process.env.TELEGRAM_WEBHOOK_SECRET = 'correct_secret_token_12345';

      const req = new Request('http://localhost:3000/api/telegram/webhook', {
        method: 'POST',
        headers: {
          'x-telegram-bot-api-secret-token': 'wrong_secret_token_00000',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ message: { message_id: 1 } }),
      });

      const res = await handleTelegramWebhook(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain('Unauthorized');
    });

    it('safely acknowledges updates from unauthorized chat IDs with HTTP 200 ignored', async () => {
      process.env.TELEGRAM_WEBHOOK_SECRET = 'secret_token_abc';
      process.env.TELEGRAM_ALLOWED_CHAT_IDS = '-100999888777';

      const req = new Request('http://localhost:3000/api/telegram/webhook', {
        method: 'POST',
        headers: {
          'x-telegram-bot-api-secret-token': 'secret_token_abc',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            message_id: 10,
            chat: { id: -100111222333 }, // unauthorized chat
            document: { file_id: 'f1', file_name: 'test.pdf' },
          },
        }),
      });

      const res = await handleTelegramWebhook(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.ignored).toBe(true);
      expect(json.reason).toContain('Unauthorized chat ID');
    });

    it('safely ignores non-PDF documents with HTTP 200 ignored', async () => {
      process.env.TELEGRAM_WEBHOOK_SECRET = 'secret_token_abc';
      process.env.TELEGRAM_ALLOWED_CHAT_IDS = '-100999888777';

      const req = new Request('http://localhost:3000/api/telegram/webhook', {
        method: 'POST',
        headers: {
          'x-telegram-bot-api-secret-token': 'secret_token_abc',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            message_id: 11,
            chat: { id: -100999888777 },
            document: {
              file_id: 'img1',
              file_name: 'screenshot.png',
              mime_type: 'image/png',
            },
          },
        }),
      });

      const res = await handleTelegramWebhook(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.ignored).toBe(true);
      expect(json.reason).toContain('Unsupported MIME type');
    });

    it('processes valid PDF message update and creates pending record', async () => {
      process.env.TELEGRAM_WEBHOOK_SECRET = 'secret_token_abc';
      process.env.TELEGRAM_ALLOWED_CHAT_IDS = '-100999888777';

      let insertedUpload: any = null;
      const mockDb = {
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
              insert: vi.fn((data) => {
                insertedUpload = data;
                return {
                  select: vi.fn(() => ({
                    single: vi.fn().mockResolvedValue({
                      data: { id: 'tg-upload-123', ...data },
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
      (getAdminClient as any).mockReturnValue(mockDb);

      const req = new Request('http://localhost:3000/api/telegram/webhook', {
        method: 'POST',
        headers: {
          'x-telegram-bot-api-secret-token': 'secret_token_abc',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            message_id: 42,
            chat: { id: -100999888777, title: 'PDF Archive Group' },
            document: {
              file_id: 'tg_file_42',
              file_unique_id: 'unique_42',
              file_name: 'Quantum_Computing_Overview.pdf',
              file_size: 2048000,
              mime_type: 'application/pdf',
            },
            caption: '', // Empty caption test
          },
        }),
      });

      const res = await handleTelegramWebhook(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.upload_id).toBe('tg-upload-123');
      expect(insertedUpload.title).toBe('Quantum Computing Overview');
      expect(insertedUpload.source_type).toBe('telegram');
      expect(insertedUpload.status).toBe('pending');
    });

    it('processes valid channel_post update identically to message', async () => {
      process.env.TELEGRAM_WEBHOOK_SECRET = 'secret_token_abc';
      process.env.TELEGRAM_ALLOWED_CHAT_IDS = '-100999888777';

      let insertedUpload: any = null;
      const mockDb = {
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
              insert: vi.fn((data) => {
                insertedUpload = data;
                return {
                  select: vi.fn(() => ({
                    single: vi.fn().mockResolvedValue({
                      data: { id: 'tg-channel-post-id', ...data },
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
      (getAdminClient as any).mockReturnValue(mockDb);

      const req = new Request('http://localhost:3000/api/telegram/webhook', {
        method: 'POST',
        headers: {
          'x-telegram-bot-api-secret-token': 'secret_token_abc',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          channel_post: {
            message_id: 88,
            chat: { id: -100999888777, title: 'Broadcast Channel' },
            document: {
              file_id: 'channel_doc_88',
              file_unique_id: 'uniq_channel_88',
              file_name: 'Weekly_Paper.pdf',
              file_size: 1024000,
              mime_type: 'application/pdf',
            },
            caption: 'Weekly Academic Paper Release',
          },
        }),
      });

      const res = await handleTelegramWebhook(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(insertedUpload.title).toBe('Weekly Academic Paper Release');
    });

    it('handles duplicate webhook retry idempotently without creating duplicate records', async () => {
      process.env.TELEGRAM_WEBHOOK_SECRET = 'secret_token_abc';
      process.env.TELEGRAM_ALLOWED_CHAT_IDS = '-100999888777';

      const existingUpload = {
        id: 'existing-id-77',
        telegram_chat_id: -100999888777,
        telegram_message_id: 100,
        title: 'Already Ingested',
        status: 'pending',
      };

      const mockDb = {
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
              insert: vi.fn(), // Must NOT be called
            };
          }
          return {};
        }),
      };
      (getAdminClient as any).mockReturnValue(mockDb);

      const req = new Request('http://localhost:3000/api/telegram/webhook', {
        method: 'POST',
        headers: {
          'x-telegram-bot-api-secret-token': 'secret_token_abc',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            message_id: 100,
            chat: { id: -100999888777 },
            document: {
              file_id: 'f1',
              file_unique_id: 'u1',
              file_name: 'test.pdf',
              file_size: 1000,
              mime_type: 'application/pdf',
            },
          },
        }),
      });

      const res = await handleTelegramWebhook(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.upload_id).toBe('existing-id-77');
      expect(json.is_duplicate).toBe(true);
      expect(mockDb.from('telegram_uploads').insert).not.toHaveBeenCalled();
    });
  });
});
