import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getDocuments,
  getDocumentById,
  createDocument,
  updateDocument,
  deleteDocument,
  toggleLike,
} from '../lib/services/documentService';
import {
  getNotes,
  createNote,
  updateNote,
  deleteNote,
} from '../lib/services/notesService';
import {
  getBookmarks,
  createBookmark,
  deleteBookmark,
} from '../lib/services/bookmarksService';
import {
  getAnnotations,
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
} from '../lib/services/annotationsService';
import {
  getNotebooks,
  createNotebook,
  deleteNotebook,
} from '../lib/services/notebooksService';
import { upsertReadingProgress } from '../lib/services/readingProgressService';
import {
  createSubmission,
  reviewSubmission,
} from '../lib/services/moderationService';
import {
  checkRateLimit,
  setRateLimitStore,
  MemorySharedRateLimitStore,
} from '../lib/api/rateLimit';

describe('Backend API & Service Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Documents Service', () => {
    it('creates document record associated with authenticated user', async () => {
      const insertedDoc = {
        id: 'doc-uuid-1',
        user_id: 'user-123',
        title: 'Distributed Systems Patterns',
        file_name: 'paper.pdf',
        file_size: 204800,
        page_count: 10,
        is_public: false,
        status: 'published',
      };

      const mockSupabase: any = {
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: insertedDoc, error: null }),
            }),
          }),
        }),
      };

      const created = await createDocument(mockSupabase, {
        user_id: 'user-123',
        title: 'Distributed Systems Patterns',
        file_name: 'paper.pdf',
        file_size: 204800,
        page_count: 10,
      });

      expect(created.id).toBe('doc-uuid-1');
      expect(created.user_id).toBe('user-123');
    });

    it('rejects unauthorized document update attempts (ownership verification)', async () => {
      const mockSupabase: any = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'doc-1', user_id: 'owner-user', is_public: false, status: 'published' },
                error: null,
              }),
            }),
          }),
        }),
      };

      // Attacker 'hacker-user' tries to update doc owned by 'owner-user'
      await expect(
        updateDocument(mockSupabase, 'doc-1', { title: 'Hacked Title' }, 'hacker-user', false)
      ).rejects.toThrow('FORBIDDEN');
    });

    it('allows document update when user is owner or admin', async () => {
      const updatedDoc = {
        id: 'doc-1',
        user_id: 'owner-user',
        title: 'Updated Safe Title',
        is_public: false,
        status: 'published',
      };

      const mockSupabase: any = {
        from: vi.fn().mockImplementation((table: string) => ({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'doc-1', user_id: 'owner-user', is_public: false, status: 'published' },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: updatedDoc, error: null }),
              }),
            }),
          }),
        })),
      };

      const res = await updateDocument(
        mockSupabase,
        'doc-1',
        { title: 'Updated Safe Title' },
        'owner-user',
        false
      );

      expect(res?.title).toBe('Updated Safe Title');
    });

    it('rejects unauthorized document deletion attempts', async () => {
      const mockSupabase: any = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'doc-1', user_id: 'legit-owner', is_public: false, status: 'published' },
                error: null,
              }),
            }),
          }),
        }),
      };

      await expect(
        deleteDocument(mockSupabase, 'doc-1', 'other-user', false, false)
      ).rejects.toThrow('FORBIDDEN');
    });
  });

  describe('Notes Service', () => {
    it('creates note scoped to authenticated user and returns created note', async () => {
      const noteData = {
        id: 'note-1',
        user_id: 'usr-1',
        title: 'Raft Consensus Notes',
        content_html: '<p>Key invariants of Raft</p>',
      };

      const mockSupabase: any = {
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: noteData, error: null }),
            }),
          }),
        }),
      };

      const note = await createNote(mockSupabase, { title: 'Raft Consensus Notes', content_html: '<p>Key invariants of Raft</p>' }, 'usr-1');
      expect(note.id).toBe('note-1');
      expect(note.user_id).toBe('usr-1');
    });

    it('queries notes filtered strictly by authenticated user_id', async () => {
      const eqMock = vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [{ id: 'n1', user_id: 'user-77', title: 'Note 1' }],
          error: null,
        }),
      });

      const mockSupabase: any = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: eqMock,
          }),
        }),
      };

      const notes = await getNotes(mockSupabase, 'user-77');
      expect(notes).toHaveLength(1);
      expect(eqMock).toHaveBeenCalledWith('user_id', 'user-77');
    });
  });

  describe('Bookmarks Service', () => {
    it('creates or upserts bookmark with unique (user_id, document_id, page_number)', async () => {
      const upsertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'bm-1', user_id: 'usr-1', document_id: 'doc-1', page_number: 5 },
            error: null,
          }),
        }),
      });

      const mockSupabase: any = {
        from: vi.fn().mockReturnValue({
          upsert: upsertMock,
        }),
      };

      const bm = await createBookmark(mockSupabase, { document_id: 'doc-1', page_number: 5 }, 'usr-1');
      expect(bm.page_number).toBe(5);
      expect(upsertMock).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'usr-1', document_id: 'doc-1', page_number: 5 }),
        expect.objectContaining({ onConflict: 'user_id, document_id, page_number' })
      );
    });
  });

  describe('Reading Progress Service', () => {
    it('upserts reading progress correctly and calculates percentage', async () => {
      const upsertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'prog-1',
              user_id: 'u1',
              document_id: 'd1',
              current_page: 5,
              total_pages: 20,
              percentage: 25.0,
              zoom_level: 1.25,
            },
            error: null,
          }),
        }),
      });

      const mockSupabase: any = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'reading_progress') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: { active_seconds: 30 }, error: null }),
                  }),
                }),
              }),
              upsert: upsertMock,
            };
          }
          return {};
        }),
      };

      const result = await upsertReadingProgress(
        mockSupabase,
        {
          document_id: 'd1',
          current_page: 5,
          total_pages: 20,
          zoom_level: 1.25,
          active_seconds: 15,
        },
        'u1'
      );

      expect(result.percentage).toBe(25.0);
      expect(upsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'u1',
          document_id: 'd1',
          current_page: 5,
          total_pages: 20,
          active_seconds: 45, // 30 accumulated + 15 new
        }),
        expect.objectContaining({ onConflict: 'user_id, document_id' })
      );
    });
  });

  describe('Rate Limiter', () => {
    beforeEach(() => {
      setRateLimitStore(new MemorySharedRateLimitStore());
    });

    afterEach(() => {
      setRateLimitStore(null);
    });

    it('enforces limit and blocks excessive calls within the time window', async () => {
      const key = `test_limit_${Date.now()}`;
      const limit = 3;
      const windowMs = 5000;

      // First 3 calls succeed
      expect((await checkRateLimit(key, limit, windowMs)).success).toBe(true);
      expect((await checkRateLimit(key, limit, windowMs)).success).toBe(true);
      expect((await checkRateLimit(key, limit, windowMs)).success).toBe(true);

      // 4th call is rate-limited
      const rateLimited = await checkRateLimit(key, limit, windowMs);
      expect(rateLimited.success).toBe(false);
      expect(rateLimited.remaining).toBe(0);
      expect(rateLimited.resetMs).toBeGreaterThan(0);
    });
  });
});
