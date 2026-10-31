import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { getDocuments, getDocumentById } from '../lib/services/documentService';
import { approveAndPublishUpload } from '../lib/services/telegramService';
import { GET as handleDocumentsGet } from '../app/api/documents/route';

// Mock getAdminClient for telegramService
vi.mock('../lib/supabase/admin', () => {
  return {
    getAdminClient: vi.fn(),
  };
});

// Mock createClient for route tests
vi.mock('../lib/supabase/server', () => {
  return {
    createClient: vi.fn(),
  };
});

import { getAdminClient } from '../lib/supabase/admin';
import { createClient } from '../lib/supabase/server';

describe('OpenShelf — Database Schema & Publishing Workflow Fix Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Issue 1: Elimination of thumbnail_url & Hallucinated Column Dependencies', () => {
    it('verifies src/lib/services/documentService.ts does NOT query documents.thumbnail_url or nonexistent columns', () => {
      const filePath = path.join(process.cwd(), 'src/lib/services/documentService.ts');
      const content = fs.readFileSync(filePath, 'utf-8');

      // Must not query documents.thumbnail_url or old catalog columns string
      expect(content).not.toContain('thumbnail_url');
      expect(content).not.toContain('downloads_count');
      expect(content).not.toContain('contributor_name');
    });

    it('verifies Document TypeScript interface matches the authoritative documents database table', () => {
      const typePath = path.join(process.cwd(), 'src/lib/types/database.ts');
      const content = fs.readFileSync(typePath, 'utf-8');

      // Document uses cover_image_url, NOT thumbnail_url
      expect(content).toContain('cover_image_url: string | null;');
      expect(content).not.toMatch(/interface Document\s*\{[^}]*thumbnail_url/);
    });

    it('executes getDocuments using select(*) and correctly handles public published filter', async () => {
      let selectArg = '';
      const mockQueryBuilder: any = {
        eq: vi.fn().mockReturnThis(),
        contains: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'doc-approved-1',
              title: 'Distributed Systems Guide',
              description: 'Raft consensus & paxos',
              file_name: 'distributed.pdf',
              file_size: 1048576,
              mime_type: 'application/pdf',
              page_count: 24,
              storage_type: 'telegram',
              storage_file_id: 'tg-file-123',
              is_public: true,
              status: 'published',
              categories: ['Computer Science'],
              tags: ['Distributed Systems', 'Cloud'],
              likes_count: 12,
              views_count: 85,
              is_trash: false,
              is_deleted: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
          count: 1,
          error: null,
        }),
      };

      const mockSupabase = {
        from: vi.fn((table: string) => {
          expect(table).toBe('documents');
          return {
            select: vi.fn((cols: string) => {
              selectArg = cols;
              return mockQueryBuilder;
            }),
          };
        }),
      } as any;

      const result = await getDocuments(mockSupabase, { isPublic: true });

      expect(selectArg).toBe('*');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('is_public', true);
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('status', 'published');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('is_trash', false);
      expect(result.documents).toHaveLength(1);
      expect(result.documents[0].id).toBe('doc-approved-1');
      expect(result.documents[0].title).toBe('Distributed Systems Guide');
    });
  });

  describe('2. Issue 2: End-to-End Admin Approval & Public Catalog Visibility', () => {
    it('approves a pending Telegram upload and publishes it to the documents table', async () => {
      let insertedDoc: any = null;
      let updatedUpload: any = null;

      const pendingUpload = {
        id: 'upload-uuid-99',
        telegram_file_id: 'tg-binary-file-id-abc',
        telegram_file_unique_id: 'tg-unique-id-abc',
        telegram_chat_id: -1001234567890,
        telegram_message_id: 8899,
        original_filename: 'distributed-consensus.pdf',
        mime_type: 'application/pdf',
        file_size: 2048576,
        file_hash: 'sha256-hash-val',
        title: 'Distributed Consensus with Raft',
        description: 'Comprehensive study guide on consensus',
        category_name: 'Computer Science',
        tags: ['Distributed Systems', 'Raft'],
        status: 'pending',
        document_id: null,
        source_type: 'telegram',
      };

      const mockAdminClient = {
        from: vi.fn((table: string) => {
          if (table === 'telegram_uploads') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({ data: pendingUpload, error: null }),
                  maybeSingle: vi.fn().mockResolvedValue({ data: pendingUpload }),
                })),
              })),
              update: vi.fn((payload) => {
                updatedUpload = payload;
                return {
                  eq: vi.fn(() => ({
                    select: vi.fn(() => ({
                      single: vi.fn().mockResolvedValue({
                        data: { ...pendingUpload, ...payload },
                        error: null,
                      }),
                    })),
                  })),
                };
              }),
            };
          }
          if (table === 'documents') {
            return {
              insert: vi.fn((payload) => {
                insertedDoc = payload;
                return {
                  select: vi.fn(() => ({
                    single: vi.fn().mockResolvedValue({
                      data: { id: 'doc-published-uuid-123', ...payload },
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

      const approvalResult = await approveAndPublishUpload('upload-uuid-99', 'admin_tester');

      expect(approvalResult.success).toBe(true);
      expect(approvalResult.document?.id).toBe('doc-published-uuid-123');

      // Verify inserted document publishing fields
      expect(insertedDoc).not.toBeNull();
      expect(insertedDoc.title).toBe('Distributed Consensus with Raft');
      expect(insertedDoc.status).toBe('published');
      expect(insertedDoc.is_public).toBe(true);
      expect(insertedDoc.is_trash).toBe(false);
      expect(insertedDoc.is_deleted).toBe(false);
      expect(insertedDoc.storage_type).toBe('telegram');
      expect(insertedDoc.storage_file_id).toBe('tg-binary-file-id-abc');
      expect(insertedDoc.telegram_file_unique_id).toBe('tg-unique-id-abc');
      expect(insertedDoc.categories).toEqual(['Computer Science']);

      // Verify telegram_uploads state update
      expect(updatedUpload).not.toBeNull();
      expect(updatedUpload.status).toBe('published');
      expect(updatedUpload.document_id).toBe('doc-published-uuid-123');
      expect(updatedUpload.reviewed_by).toBe('admin_tester');
    });

    it('verifies GET /api/documents?public=true returns published documents to normal users', async () => {
      const mockDocs = [
        {
          id: 'doc-published-uuid-123',
          title: 'Distributed Consensus with Raft',
          description: 'Comprehensive study guide on consensus',
          file_name: 'distributed-consensus.pdf',
          file_size: 2048576,
          mime_type: 'application/pdf',
          page_count: 15,
          is_public: true,
          status: 'published',
          categories: ['Computer Science'],
          tags: ['Raft'],
          likes_count: 5,
          is_trash: false,
          is_deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({
              data: mockDocs,
              count: 1,
              error: null,
            }),
          })),
        })),
      };

      (createClient as any).mockResolvedValue(mockSupabase);

      const req = new Request('https://openshelf.test/api/documents?public=true');
      const res = await handleDocumentsGet(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.documents).toHaveLength(1);
      expect(json.data.documents[0].id).toBe('doc-published-uuid-123');
      expect(json.data.documents[0].status).toBe('published');
      expect(json.data.documents[0].is_public).toBe(true);
    });

    it('verifies getDocumentById enforces publication and deletion boundaries', async () => {
      const publicDoc = {
        id: 'doc-1',
        title: 'Open Document',
        is_public: true,
        status: 'published',
        is_trash: false,
        is_deleted: false,
        user_id: 'user-owner',
      };

      const deletedDoc = {
        id: 'doc-2',
        title: 'Deleted Document',
        is_public: true,
        status: 'published',
        is_trash: false,
        is_deleted: true,
        user_id: 'user-owner',
      };

      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn((_col: string, val: string) => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: val === 'doc-1' ? publicDoc : val === 'doc-2' ? deletedDoc : null,
                error: null,
              }),
            })),
          })),
        })),
      } as any;

      // Public anonymous user accessing active public document -> allowed
      const allowed = await getDocumentById(mockSupabase, 'doc-1');
      expect(allowed).not.toBeNull();
      expect(allowed?.id).toBe('doc-1');

      // Public anonymous user accessing deleted document -> denied (returns null)
      const deniedDeleted = await getDocumentById(mockSupabase, 'doc-2');
      expect(deniedDeleted).toBeNull();
    });
  });

  describe('3. Performance Migration Schema Alignment', () => {
    it('verifies 20261031200000_performance_indexes.sql only indexes existing database columns', () => {
      const migrationPath = path.join(
        process.cwd(),
        'supabase/migrations/20261031200000_performance_indexes.sql'
      );
      const sql = fs.readFileSync(migrationPath, 'utf-8');

      // Valid columns on documents
      expect(sql).toContain('created_at');
      expect(sql).toContain('is_public');
      expect(sql).toContain('status');
      expect(sql).toContain('is_trash');
      expect(sql).toContain('is_deleted');
      expect(sql).toContain('likes_count');
      expect(sql).toContain('categories');

      // Valid columns on categories
      expect(sql).toContain('name');
      expect(sql).toContain('is_visible');

      // MUST NOT contain nonexistent columns
      expect(sql).not.toContain('thumbnail_url');
      expect(sql).not.toContain('downloads_count');
      expect(sql).not.toContain('contributor_name');
    });
  });
});
