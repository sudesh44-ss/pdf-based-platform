import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { POST as handleTelegramWebhook } from '../app/api/telegram/webhook/route';
import { isChatIdAllowed, registerTelegramUpload } from '../lib/services/telegramService';
import { clientEnvSchema, serverOnlyEnvSchema } from '../lib/env';

// Mock getAdminClient for database operations
vi.mock('../lib/supabase/admin', () => {
  return {
    getAdminClient: vi.fn(),
  };
});

import { getAdminClient } from '../lib/supabase/admin';

describe('OpenShelf — Telegram-Only Submissions & Website Upload Removal Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Normal User UI Verification: Website Upload Removal', () => {
    it('verifies src/app/my-contributions/page.tsx has no direct file upload controls or dropzone', () => {
      const filePath = path.join(process.cwd(), 'src/app/my-contributions/page.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      // 1. Must NOT contain HTML file input or dropzones
      expect(content).not.toContain('type="file"');
      expect(content).not.toContain('contributionFileInput');
      expect(content).not.toContain('validatePdfBuffer');

      // 2. Must NOT call direct client upload submission API
      expect(content).not.toContain('api.contributions.submit');

      // 3. Must reference configured environment variable
      expect(content).toContain('NEXT_PUBLIC_TELEGRAM_SUBMISSION_GROUP_URL');

      // 4. Must NOT hardcode an invented Telegram URL
      expect(content).not.toMatch(/https:\/\/t\.me\/(fake|example|demo|test_channel)/i);

      // 5. Must explain manual PDF attachment and admin approval
      expect(content).toContain('Submit via Telegram');
      expect(content).toContain('Admin Approval');
      expect(content).toMatch(/attach.*PDF|select.*Document/i);
    });

    it('verifies src/app/my-library/page.tsx has no direct file upload controls or dropzone modal', () => {
      const filePath = path.join(process.cwd(), 'src/app/my-library/page.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      // Must NOT contain file input, dropzone, or upload modal
      expect(content).not.toContain('type="file"');
      expect(content).not.toContain('fileDropzone');
      expect(content).not.toContain('uploadModalOpen');
      expect(content).not.toContain('api.documents.upload');
      expect(content).not.toContain('validatePdfBuffer');

      // Header CTA must route to Telegram submissions
      expect(content).toContain('Submit via Telegram');
      expect(content).toContain('/my-contributions');
    });

    it('verifies navigation headers route to Submissions without direct upload controls', () => {
      const headerPath = path.join(process.cwd(), 'src/components/layout/Header.tsx');
      const headerContent = fs.readFileSync(headerPath, 'utf-8');
      expect(headerContent).toContain('href="/my-contributions"');

      const sidebarPath = path.join(process.cwd(), 'src/components/layout/Sidebar.tsx');
      const sidebarContent = fs.readFileSync(sidebarPath, 'utf-8');
      expect(sidebarContent).toContain('href="/my-contributions"');
    });
  });

  describe('2. Security & Environment Configuration', () => {
    it('ensures NEXT_PUBLIC_TELEGRAM_SUBMISSION_GROUP_URL is exposed to client schema safely', () => {
      const shape = clientEnvSchema.shape;
      expect(shape).toHaveProperty('NEXT_PUBLIC_TELEGRAM_SUBMISSION_GROUP_URL');
    });

    it('ensures TELEGRAM_BOT_TOKEN and secrets are NEVER exposed in clientEnvSchema', () => {
      const clientShape = clientEnvSchema.shape;
      expect(clientShape).not.toHaveProperty('TELEGRAM_BOT_TOKEN');
      expect(clientShape).not.toHaveProperty('TELEGRAM_WEBHOOK_SECRET');
      expect(clientShape).not.toHaveProperty('ADMIN_SESSION_SECRET');

      const serverShape = serverOnlyEnvSchema.shape;
      expect(serverShape).toHaveProperty('TELEGRAM_BOT_TOKEN');
      expect(serverShape).toHaveProperty('TELEGRAM_WEBHOOK_SECRET');
    });
  });

  describe('3. Telegram Allowed Chat ID Validation', () => {
    it('authorizes chat IDs from either TELEGRAM_ALLOWED_CHAT_IDS or TELEGRAM_CHANNEL_OR_CHAT_ID', () => {
      process.env.TELEGRAM_ALLOWED_CHAT_IDS = '-1009988776655, -1001122334455';
      process.env.TELEGRAM_CHANNEL_OR_CHAT_ID = '-1005544332211';

      expect(isChatIdAllowed('-1009988776655')).toBe(true);
      expect(isChatIdAllowed(-1001122334455)).toBe(true);
      expect(isChatIdAllowed('-1005544332211')).toBe(true);
      expect(isChatIdAllowed('-1000000000000')).toBe(false);
    });
  });

  describe('4. Telegram Webhook Ingestion & Payload Handling', () => {
    it('accepts and ingests incoming PDF with an empty caption, formatting title from file name', async () => {
      let insertedRow: any = null;
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
                insertedRow = payload;
                return {
                  select: vi.fn(() => ({
                    single: vi.fn().mockResolvedValue({
                      data: { id: 'upload-uuid-empty-caption', ...payload },
                      error: null,
                    }),
                  })),
                };
              }),
            };
          }
          if (table === 'admin_activity_logs' || table === 'activity_logs') {
            return { insert: vi.fn().mockResolvedValue({ error: null }) };
          }
          return {};
        }),
      };

      (getAdminClient as any).mockReturnValue(mockAdminClient);

      process.env.TELEGRAM_ALLOWED_CHAT_IDS = '-1001234567890';
      delete process.env.TELEGRAM_WEBHOOK_SECRET;

      const webhookPayload = {
        update_id: 10001,
        message: {
          message_id: 5544,
          chat: { id: -1001234567890, title: 'OpenShelf Submissions Group' },
          from: { id: 98765432, username: 'student_dev', first_name: 'Student' },
          document: {
            file_id: 'tg-file-id-abc',
            file_unique_id: 'tg-unique-abc',
            file_name: 'distributed-consensus-raft.pdf',
            mime_type: 'application/pdf',
            file_size: 1024 * 1024 * 5, // 5 MB
          },
          // caption is undefined / empty
        },
      };

      const req = new Request('http://localhost:3000/api/telegram/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload),
      });

      const res = await handleTelegramWebhook(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.upload_id).toBe('upload-uuid-empty-caption');

      // Verify derived title from filename and stored sender metadata
      expect(insertedRow).not.toBeNull();
      expect(insertedRow.title).toBe('distributed consensus raft');
      expect(insertedRow.source_type).toBe('telegram');
      expect(insertedRow.status).toBe('pending');
      expect(insertedRow.metadata.sender).toEqual({
        id: 98765432,
        username: 'student_dev',
        first_name: 'Student',
      });
    });

    it('safely rejects non-PDF files without adding to pending review', async () => {
      process.env.TELEGRAM_ALLOWED_CHAT_IDS = '-1001234567890';

      const webhookPayload = {
        update_id: 10002,
        message: {
          message_id: 5545,
          chat: { id: -1001234567890, title: 'OpenShelf Submissions Group' },
          document: {
            file_id: 'tg-file-id-exe',
            file_unique_id: 'tg-unique-exe',
            file_name: 'malicious_script.exe',
            mime_type: 'application/x-msdownload',
            file_size: 5000,
          },
        },
      };

      const req = new Request('http://localhost:3000/api/telegram/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload),
      });

      const res = await handleTelegramWebhook(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.ignored).toBe(true);
      expect(data.reason).toContain('Unsupported MIME type');
    });

    it('safely acknowledges text-only or non-document messages with HTTP 200 ignored', async () => {
      process.env.TELEGRAM_ALLOWED_CHAT_IDS = '-1001234567890';

      const textMsgPayload = {
        update_id: 10003,
        message: {
          message_id: 5546,
          chat: { id: -1001234567890, title: 'OpenShelf Submissions Group' },
          text: 'Hello, how do I submit a PDF here?',
        },
      };

      const req = new Request('http://localhost:3000/api/telegram/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(textMsgPayload),
      });

      const res = await handleTelegramWebhook(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.ignored).toBe(true);
      expect(data.reason).toBe('Not a document');
    });

    it('handles idempotent webhook retries safely for duplicate message delivery', async () => {
      const mockAdminClient = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: 'existing-upload-uuid',
                    status: 'pending',
                    telegram_chat_id: -1001234567890,
                    telegram_message_id: 5544,
                  },
                }),
              })),
            })),
          })),
        })),
      };

      (getAdminClient as any).mockReturnValue(mockAdminClient);

      const result = await registerTelegramUpload({
        chatId: -1001234567890,
        messageId: 5544,
        fileId: 'tg-file-1',
        fileUniqueId: 'tg-unique-1',
        fileName: 'existing.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
      });

      expect(result.success).toBe(true);
      expect(result.isDuplicate).toBe(true);
      expect(result.upload?.id).toBe('existing-upload-uuid');
    });

    it('detects duplicate binary content via file_unique_id and sets is_duplicate: true', async () => {
      let insertedPayload: any = null;
      const mockAdminClient = {
        from: vi.fn((table: string) => {
          if (table === 'telegram_uploads') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn((col: string) => {
                  if (col === 'telegram_chat_id') {
                    return {
                      eq: vi.fn(() => ({
                        maybeSingle: vi.fn().mockResolvedValue({ data: null }), // not exact retry
                      })),
                    };
                  }
                  if (col === 'telegram_file_unique_id') {
                    return {
                      maybeSingle: vi.fn().mockResolvedValue({
                        data: { id: 'orig-upload-100', title: 'Original Paper' },
                      }),
                    };
                  }
                  return { maybeSingle: vi.fn().mockResolvedValue({ data: null }) };
                }),
              })),
              insert: vi.fn((payload) => {
                insertedPayload = payload;
                return {
                  select: vi.fn(() => ({
                    single: vi.fn().mockResolvedValue({
                      data: { id: 'new-duplicate-uuid', ...payload },
                      error: null,
                    }),
                  })),
                };
              }),
            };
          }
          if (table === 'admin_activity_logs' || table === 'activity_logs') {
            return { insert: vi.fn().mockResolvedValue({ error: null }) };
          }
          return {};
        }),
      };

      (getAdminClient as any).mockReturnValue(mockAdminClient);

      const result = await registerTelegramUpload({
        chatId: -1001234567890,
        messageId: 7788,
        fileId: 'tg-file-different-instance',
        fileUniqueId: 'tg-unique-duplicate-hash',
        fileName: 'paper-copy.pdf',
        fileSize: 2048,
        mimeType: 'application/pdf',
      });

      expect(result.success).toBe(true);
      expect(result.isDuplicate).toBe(true);
      expect(insertedPayload.is_duplicate).toBe(true);
      expect(insertedPayload.duplicate_of_id).toBe('orig-upload-100');
    });
  });

  describe('5. Admin Direct Upload Preservation', () => {
    it('verifies admin direct upload route (/api/admin/uploads) remains intact', () => {
      const adminUploadRoutePath = path.join(process.cwd(), 'src/app/api/admin/uploads/route.ts');
      expect(fs.existsSync(adminUploadRoutePath)).toBe(true);

      const content = fs.readFileSync(adminUploadRoutePath, 'utf-8');
      expect(content).toContain('createAdminDirectUpload');
      expect(content).toContain('POST');
    });
  });
});
