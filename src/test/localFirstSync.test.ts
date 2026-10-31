// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  localNotes,
  localProgress,
  localHistory,
  localSync,
  LocalNote,
} from '../lib/storage/indexedDb';
import { GET as handleSyncGet, POST as handleSyncPost } from '../app/api/sync/route';
import { GET as handleAdminUserActivity } from '../app/api/admin/user-activity/route';

// Mock authentication services
vi.mock('../lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('../lib/services/authService', () => ({
  getAuthenticatedUser: vi.fn(),
}));

// Mock admin auth & admin supabase client
vi.mock('../lib/auth/adminAuth', () => ({
  getVerifiedAdminSession: vi.fn(),
}));

vi.mock('../lib/supabase/admin', () => ({
  getAdminClient: vi.fn(),
}));

import { createClient } from '../lib/supabase/server';
import { getAuthenticatedUser } from '../lib/services/authService';
import { getVerifiedAdminSession } from '../lib/auth/adminAuth';
import { getAdminClient } from '../lib/supabase/admin';

describe('OpenShelf — Local-First User Data & Manual Cloud Sync Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Local-First Browser Persistence & Dirty Flag Tracking', () => {
    const testUser = 'user_alpha_123';

    it('creates note locally in browser with sync_status dirty and version 1', async () => {
      const note = await localNotes.save(
        {
          document_id: 'doc_101',
          page_number: 5,
          title: 'Dynamic Programming Insights',
          content_html: '<p>Memoization table state transitions...</p>',
        },
        testUser
      );

      expect(note).toBeDefined();
      expect(note.id).toBeTruthy();
      expect(note.user_id).toBe(testUser);
      expect(note.title).toBe('Dynamic Programming Insights');
      expect(note.sync_status).toBe('dirty');
      expect(note.version).toBe(1);
      expect(note.is_deleted).toBe(false);

      // Verify retrieval
      const fetched = await localNotes.getById(note.id);
      expect(fetched).not.toBeNull();
      expect(fetched?.title).toBe('Dynamic Programming Insights');
    });

    it('updates note locally, increments version, and maintains sync_status dirty', async () => {
      const initial = await localNotes.save(
        {
          document_id: 'doc_102',
          page_number: 12,
          title: 'Original Title',
          content_html: '<p>Initial draft</p>',
        },
        testUser
      );

      const updated = await localNotes.save(
        {
          ...initial,
          title: 'Revised Title with Optimizations',
          content_html: '<p>Updated implementation with LRU cache.</p>',
        },
        testUser
      );

      expect(updated.id).toBe(initial.id);
      expect(updated.title).toBe('Revised Title with Optimizations');
      expect(updated.version).toBe(2);
      expect(updated.sync_status).toBe('dirty');
    });

    it('hard deletes unsynced local-only notes (version 1) without cluttering cloud', async () => {
      const tempNote = await localNotes.save(
        {
          document_id: 'doc_103',
          title: 'Transient Scratchpad',
          content_html: '<p>Temporary calculation</p>',
        },
        testUser
      );

      await localNotes.delete(tempNote.id, testUser);
      const after = await localNotes.getById(tempNote.id);
      expect(after).toBeNull();
    });

    it('marks synced notes as tombstone (is_deleted: true) on delete to propagate deletion during manual sync', async () => {
      // Simulate a previously synchronized note
      const cloudSyncedNote = await localNotes.save(
        {
          id: 'note_cloud_synced_01',
          document_id: 'doc_104',
          title: 'Synced Cloud Note',
          content_html: '<p>Content</p>',
        },
        testUser
      );

      // Artificially simulate that it was synced and bumped
      cloudSyncedNote.sync_status = 'synced';
      cloudSyncedNote.version = 2;
      await localNotes.save(cloudSyncedNote, testUser);

      // Now delete it
      await localNotes.delete('note_cloud_synced_01', testUser);

      // Must be soft deleted (tombstone) so next cloud sync purges it from Supabase
      const list = await localNotes.list(testUser, 'doc_104');
      expect(list.some((n) => n.id === 'note_cloud_synced_01')).toBe(false);

      const pending = await localSync.getPendingChanges(testUser);
      const tombstone = pending.dirtyNotes.find((n) => n.id === 'note_cloud_synced_01');
      expect(tombstone).toBeDefined();
      expect(tombstone?.is_deleted).toBe(true);
      expect(tombstone?.sync_status).toBe('dirty');
    });

    it('persists reading progress locally without automatic cloud upload', async () => {
      const prog = await localProgress.save(
        {
          document_id: 'doc_105',
          current_page: 42,
          total_pages: 120,
          percentage: 35,
          active_seconds: 60,
        },
        testUser
      );

      expect(prog.document_id).toBe('doc_105');
      expect(prog.current_page).toBe(42);
      expect(prog.sync_status).toBe('dirty');

      const retrieved = await localProgress.get('doc_105', testUser);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.current_page).toBe(42);
      expect(retrieved?.active_seconds).toBe(60);
    });

    it('records reading session history locally with sync_status dirty', async () => {
      const entry = await localHistory.record(
        {
          document_id: 'doc_105',
          document_title: 'Database Internals',
          page_number: 42,
          active_seconds: 15,
        },
        testUser
      );

      expect(entry.id).toBeTruthy();
      expect(entry.document_id).toBe('doc_105');
      expect(entry.page_number).toBe(42);
      expect(entry.sync_status).toBe('dirty');

      const history = await localHistory.getAll(testUser);
      expect(history.some((h) => h.id === entry.id)).toBe(true);
    });
  });

  describe('2. User Isolation & Pending Changes Accounting', () => {
    const userA = 'user_isolation_A';
    const userB = 'user_isolation_B';

    it('strictly isolates dirty data between different user accounts', async () => {
      await localNotes.save(
        {
          document_id: 'doc_isolation',
          title: "User A's Confidential Note",
          content_html: '<p>Private to A</p>',
        },
        userA
      );

      await localProgress.save(
        {
          document_id: 'doc_isolation',
          current_page: 88,
          total_pages: 100,
          active_seconds: 300,
        },
        userA
      );

      const pendingA = await localSync.getPendingChanges(userA);
      const pendingB = await localSync.getPendingChanges(userB);

      expect(pendingA.totalDirty).toBeGreaterThanOrEqual(2);
      expect(pendingA.dirtyNotes.some((n) => n.user_id === userA)).toBe(true);

      // User B must have zero visibility into User A's pending data
      expect(pendingB.dirtyNotes.some((n) => n.user_id === userA)).toBe(false);
      expect(pendingB.dirtyProgress.some((p) => p.user_id === userA)).toBe(false);
    });
  });

  describe('3. Manual Cloud Sync API (GET & POST /api/sync)', () => {
    it('rejects unauthenticated requests to GET /api/sync with HTTP 401', async () => {
      (createClient as any).mockResolvedValue({});
      (getAuthenticatedUser as any).mockResolvedValue(null);

      const res = await handleSyncGet();
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects unauthenticated requests to POST /api/sync with HTTP 401', async () => {
      (createClient as any).mockResolvedValue({});
      (getAuthenticatedUser as any).mockResolvedValue(null);

      const req = new Request('http://localhost:3000/api/sync', {
        method: 'POST',
        body: JSON.stringify({ dirtyNotes: [] }),
      });

      const res = await handleSyncPost(req);
      expect(res.status).toBe(401);
    });

    it('synchronizes dirty data and marks local records as synced with server timestamp', async () => {
      const syncUser = { id: 'user_synced_success_99', email: 'sync@example.com' };

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'notes') {
            return {
              delete: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null }),
              upsert: vi.fn().mockResolvedValue({ error: null }),
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'note_sync_test_01',
                    title: 'Cloud Synced Note',
                    content_html: '<p>Content</p>',
                    updated_at: new Date().toISOString(),
                  },
                ],
              }),
            };
          }
          if (table === 'reading_progress') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: { active_seconds: 30 } }),
              upsert: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: {
                  document_id: 'doc_sync_01',
                  current_page: 15,
                  total_pages: 50,
                  percentage: 30,
                  active_seconds: 45,
                },
                error: null,
              }),
            };
          }
          if (table === 'reading_history' || table === 'user_sync_meta') {
            return {
              insert: vi.fn().mockResolvedValue({ error: null }),
              upsert: vi.fn().mockResolvedValue({ error: null }),
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue({ data: [] }),
              maybeSingle: vi.fn().mockResolvedValue({ data: null }),
            };
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
          };
        }),
      };

      (createClient as any).mockResolvedValue(mockSupabase);
      (getAuthenticatedUser as any).mockResolvedValue(syncUser);

      // Create dirty note locally
      const dirtyNote = await localNotes.save(
        {
          id: 'note_sync_test_01',
          document_id: 'doc_sync_01',
          title: 'Cloud Synced Note',
          content_html: '<p>Content</p>',
        },
        syncUser.id
      );

      const req = new Request('http://localhost:3000/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dirtyNotes: [dirtyNote],
          dirtyProgress: [
            {
              document_id: 'doc_sync_01',
              current_page: 15,
              total_pages: 50,
              percentage: 30,
              active_seconds: 15,
            },
          ],
          dirtyHistory: [],
        }),
      });

      const res = await handleSyncPost(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.synced).toBe(true);
      expect(json.data.serverTimestamp).toBeTruthy();
      expect(json.data.conflicts).toHaveLength(0);

      // Apply snapshot locally
      const applyResult = await localSync.applyServerSnapshot(syncUser.id, {
        notes: json.data.notes,
        readingProgress: json.data.readingProgress,
        serverTimestamp: json.data.serverTimestamp,
      });

      expect(applyResult.conflicts).toHaveLength(0);

      // Verify note is now marked 'synced' locally
      const syncedNote = await localNotes.getById('note_sync_test_01');
      expect(syncedNote?.sync_status).toBe('synced');
    });

    it('safely detects multi-device note conflicts and does NOT overwrite server data silently', async () => {
      const conflictUser = { id: 'user_conflict_101', email: 'conflict@example.com' };

      const serverVersion = {
        id: 'note_conflict_99',
        title: 'Server Note Modified on Device B',
        content_html: '<p>Device B updated this 1 minute ago</p>',
        updated_at: new Date(Date.now() + 10000).toISOString(), // Strictly newer than client
      };

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'notes') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: serverVersion }),
              order: vi.fn().mockResolvedValue({ data: [serverVersion] }),
              upsert: vi.fn().mockResolvedValue({ error: null }),
            };
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            upsert: vi.fn().mockResolvedValue({ error: null }),
            order: vi.fn().mockResolvedValue({ data: [] }),
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          };
        }),
      };

      (createClient as any).mockResolvedValue(mockSupabase);
      (getAuthenticatedUser as any).mockResolvedValue(conflictUser);

      // Local client edited the same note simultaneously on Device A
      const clientNote: LocalNote = {
        id: 'note_conflict_99',
        user_id: conflictUser.id,
        document_id: 'doc_conflict',
        title: 'Client Note Modified on Device A',
        content_html: '<p>Device A local changes</p>',
        version: 2,
        client_updated_at: new Date(Date.now() - 5000).toISOString(),
        sync_status: 'dirty',
      };

      const req = new Request('http://localhost:3000/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dirtyNotes: [clientNote],
          dirtyProgress: [],
          dirtyHistory: [],
        }),
      });

      const res = await handleSyncPost(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      // Must detect conflict
      expect(json.data.conflicts).toHaveLength(1);
      expect(json.data.conflicts[0].id).toBe('note_conflict_99');
      expect(json.data.conflicts[0].server_title).toBe('Server Note Modified on Device B');

      // Applying snapshot preserves local changes in conflict mode
      await localNotes.save(clientNote, conflictUser.id);
      const applyResult = await localSync.applyServerSnapshot(conflictUser.id, {
        notes: [serverVersion],
        readingProgress: [],
        serverTimestamp: json.data.serverTimestamp,
      });

      expect(applyResult.conflicts).toHaveLength(1);
      const storedNote = await localNotes.getById('note_conflict_99');
      expect(storedNote?.sync_status).toBe('conflict');
      expect(storedNote?.conflict_data).toBeDefined();
      expect(storedNote?.conflict_data?.server_title).toBe('Server Note Modified on Device B');
    });
  });

  describe('4. "Logout Without Save" Precision', () => {
    const userDiscard = 'user_discard_456';
    const otherAccount = 'user_other_789';

    it('discards ONLY dirty changes for the active user, preserving synced data and other users', async () => {
      // 1. User has an already-synced note
      const syncedNote = await localNotes.save(
        {
          id: 'note_preserved_synced',
          title: 'Already Synced Note',
          content_html: '<p>Must not be lost</p>',
        },
        userDiscard
      );
      syncedNote.sync_status = 'synced';
      await localNotes.save(syncedNote, userDiscard);

      // 2. User has an unsaved dirty note
      await localNotes.save(
        {
          id: 'note_unsaved_dirty',
          title: 'Unsaved Local Draft',
          content_html: '<p>To be discarded</p>',
        },
        userDiscard
      );

      // 3. User has dirty reading progress
      await localProgress.save(
        {
          document_id: 'doc_to_discard',
          current_page: 99,
          total_pages: 100,
          active_seconds: 500,
        },
        userDiscard
      );

      // 4. Other user has dirty note
      await localNotes.save(
        {
          id: 'note_other_user_dirty',
          title: "Other User's Note",
          content_html: '<p>Must remain intact</p>',
        },
        otherAccount
      );

      // Execute "Logout Without Save"
      await localSync.discardUnsynced(userDiscard);

      // Verifications:
      // A. Dirty note of active user was discarded
      const dirtyCheck = await localNotes.getById('note_unsaved_dirty');
      expect(dirtyCheck).toBeNull();

      // B. Dirty reading progress of active user was discarded
      const progCheck = await localProgress.get('doc_to_discard', userDiscard);
      expect(progCheck).toBeNull();

      // C. Synced note of active user is preserved
      const syncedCheck = await localNotes.getById('note_preserved_synced');
      expect(syncedCheck).not.toBeNull();
      expect(syncedCheck?.sync_status).toBe('synced');

      // D. Other user's dirty data was untouched
      const otherCheck = await localNotes.getById('note_other_user_dirty');
      expect(otherCheck).not.toBeNull();
      expect(otherCheck?.user_id).toBe(otherAccount);
    });
  });

  describe('5. Admin User Reading Activity Overview & Strict Privacy', () => {
    it('requires verified admin session for /api/admin/user-activity', async () => {
      (getVerifiedAdminSession as any).mockResolvedValue({ valid: false });

      const req = new Request('http://localhost:3000/api/admin/user-activity');
      const res = await handleAdminUserActivity(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('returns reading activity metadata and guarantees personal notes are strictly excluded', async () => {
      (getVerifiedAdminSession as any).mockResolvedValue({ valid: true, username: 'admin' });

      let capturedSelect = '';
      const mockAdminClient = {
        from: vi.fn((table: string) => {
          expect(table).toBe('reading_progress');
          return {
            select: vi.fn((projection: string) => {
              capturedSelect = projection;
              return {
                order: vi.fn().mockReturnThis(),
                range: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'prog_1',
                      user_id: 'user_uuid_1',
                      document_id: 'doc_uuid_1',
                      current_page: 25,
                      total_pages: 100,
                      percentage: 25,
                      active_seconds: 450,
                      last_read_at: '2026-10-31T20:00:00Z',
                      documents: {
                        id: 'doc_uuid_1',
                        title: 'Distributed Systems Patterns',
                        page_count: 100,
                      },
                      profiles: {
                        id: 'user_uuid_1',
                        email: 'learner@example.com',
                        full_name: 'Alex Reader',
                      },
                    },
                  ],
                  count: 1,
                  error: null,
                }),
              };
            }),
          };
        }),
      };

      (getAdminClient as any).mockReturnValue(mockAdminClient);

      const req = new Request('http://localhost:3000/api/admin/user-activity');
      const res = await handleAdminUserActivity(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.data.activity).toHaveLength(1);
      const record = json.data.activity[0];
      expect(record.document_title).toBe('Distributed Systems Patterns');
      expect(record.current_page).toBe(25);
      expect(record.active_seconds).toBe(450);

      // STRICT PRIVACY VERIFICATION:
      // 1. Query projection must never request notes table or note content fields
      expect(capturedSelect).not.toContain('notes');
      expect(capturedSelect).not.toContain('content_html');
      expect(capturedSelect).not.toContain('content_json');

      // 2. Response record must contain zero note content
      expect((record as any).notes).toBeUndefined();
      expect((record as any).content_html).toBeUndefined();
      expect((record as any).content_json).toBeUndefined();
      expect(json.data.privacyGuarantee).toContain('Personal notes content is client-side encrypted / local-first and strictly excluded');
    });
  });
});
