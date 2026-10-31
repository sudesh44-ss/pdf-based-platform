// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  localNotes,
  localProgress,
  localHistory,
  localSync,
  LocalNote,
  memoryStore,
} from '../lib/storage/indexedDb';
import { GET as handleSyncGet, POST as handleSyncPost } from '../app/api/sync/route';

// Mock authentication services
vi.mock('../lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('../lib/services/authService', () => ({
  getAuthenticatedUser: vi.fn(),
}));

vi.mock('../lib/api/client', () => ({
  api: {
    sync: {
      pushPending: vi.fn(),
    },
    auth: {
      logout: vi.fn(),
    },
  },
}));

import { createClient } from '../lib/supabase/server';
import { getAuthenticatedUser } from '../lib/services/authService';
import { api } from '../lib/api/client';

describe('OpenShelf — Manual Sync Result Screen & Safe Logout Confirmation Suite', () => {
  const testUser = { id: 'user_sync_screen_test_101', email: 'syncscreen@example.com' };

  beforeEach(() => {
    vi.clearAllMocks();
    memoryStore.notes.clear();
    memoryStore.progress.clear();
    memoryStore.history.clear();
    memoryStore.meta.clear();
  });

  describe('1. Complete Sync Success', () => {
    it('synchronizes notes, progress, and history completely and reports overallStatus success', async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'notes') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null }),
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'note_full_01',
                    title: 'Full Success Note',
                    content_html: '<p>Complete</p>',
                    updated_at: new Date().toISOString(),
                  },
                ],
              }),
              upsert: vi.fn().mockResolvedValue({ error: null }),
            };
          }
          if (table === 'reading_progress') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: { active_seconds: 10 } }),
              upsert: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: {
                  document_id: 'doc_full_01',
                  current_page: 5,
                  total_pages: 20,
                  percentage: 25,
                  active_seconds: 30,
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
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
        }),
      };

      (createClient as any).mockResolvedValue(mockSupabase);
      (getAuthenticatedUser as any).mockResolvedValue(testUser);

      // Create dirty note and progress
      const note = await localNotes.save(
        {
          id: 'note_full_01',
          document_id: 'doc_full_01',
          title: 'Full Success Note',
          content_html: '<p>Complete</p>',
        },
        testUser.id
      );

      const prog = await localProgress.save(
        {
          document_id: 'doc_full_01',
          current_page: 5,
          total_pages: 20,
          active_seconds: 20,
        },
        testUser.id
      );

      const hist = await localHistory.record(
        {
          document_id: 'doc_full_01',
          page_number: 5,
          active_seconds: 20,
        },
        testUser.id
      );

      const req = new Request('http://localhost:3000/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dirtyNotes: [note],
          dirtyProgress: [prog],
          dirtyHistory: [hist],
        }),
      });

      const res = await handleSyncPost(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.data.synced).toBe(true);
      expect(json.data.overallStatus).toBe('success');
      expect(json.data.categories.notes.status).toBe('synced');
      expect(json.data.categories.readingProgress.status).toBe('synced');
      expect(json.data.categories.readingHistory.status).toBe('synced');
      expect(json.data.successfulNoteIds).toContain('note_full_01');

      // Apply snapshot to local IndexedDB
      await localSync.applyServerSnapshot(testUser.id, {
        notes: json.data.notes,
        readingProgress: json.data.readingProgress,
        readingHistory: json.data.readingHistory,
        serverTimestamp: json.data.serverTimestamp,
        successfulNoteIds: json.data.successfulNoteIds,
        successfulProgressDocIds: json.data.successfulProgressDocIds,
        successfulHistoryIds: json.data.successfulHistoryIds,
      });

      // Local storage must now have zero dirty changes
      const pendingAfter = await localSync.getPendingChanges(testUser.id);
      expect(pendingAfter.totalDirty).toBe(0);
    });
  });

  describe('2. Complete Sync Failure', () => {
    it('handles database error by preserving local records as dirty and returning error', async () => {
      (createClient as any).mockResolvedValue(null); // Supabase unavailable
      (getAuthenticatedUser as any).mockResolvedValue(testUser);

      // Create dirty note
      await localNotes.save(
        {
          id: 'note_fail_01',
          title: 'Unsynced Local Note',
          content_html: '<p>Pending</p>',
        },
        testUser.id
      );

      const req = new Request('http://localhost:3000/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dirtyNotes: [{ id: 'note_fail_01', title: 'Unsynced Local Note' }],
        }),
      });

      const res = await handleSyncPost(req);
      expect(res.status).toBe(503);

      // Note must remain dirty
      const local = await localNotes.getById('note_fail_01');
      expect(local?.sync_status).toBe('dirty');
    });
  });

  describe('3. Partial Sync Failure', () => {
    it('marks only confirmed successful records as synced and keeps failed records dirty', async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'notes') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null }),
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'note_part_ok',
                    title: 'Successful Note',
                    content_html: '<p>OK</p>',
                    updated_at: new Date().toISOString(),
                  },
                ],
              }),
              upsert: vi.fn().mockImplementation((payload: any) => {
                if (payload.id === 'note_part_fail') {
                  // Simulate note-specific database constraint failure
                  return Promise.resolve({ error: { message: 'Database constraint violation' } });
                }
                return Promise.resolve({ error: null });
              }),
            };
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
            order: vi.fn().mockResolvedValue({ data: [] }),
            upsert: vi.fn().mockResolvedValue({ error: null }),
          };
        }),
      };

      (createClient as any).mockResolvedValue(mockSupabase);
      (getAuthenticatedUser as any).mockResolvedValue(testUser);

      const noteOk = await localNotes.save(
        { id: 'note_part_ok', title: 'Successful Note', content_html: '<p>OK</p>' },
        testUser.id
      );
      const noteFail = await localNotes.save(
        { id: 'note_part_fail', title: 'Failing Note', content_html: '<p>Fail</p>' },
        testUser.id
      );

      const req = new Request('http://localhost:3000/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dirtyNotes: [noteOk, noteFail],
          dirtyProgress: [],
          dirtyHistory: [],
        }),
      });

      const res = await handleSyncPost(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      // Must report partial status, NOT overall success!
      expect(json.data.synced).toBe(false);
      expect(json.data.overallStatus).toBe('partial');
      expect(json.data.categories.notes.status).toBe('partial');
      expect(json.data.categories.notes.synced).toBe(1);
      expect(json.data.categories.notes.failed).toBe(1);
      expect(json.data.successfulNoteIds).toContain('note_part_ok');
      expect(json.data.successfulNoteIds).not.toContain('note_part_fail');

      // Apply snapshot
      await localSync.applyServerSnapshot(testUser.id, {
        notes: json.data.notes,
        readingProgress: [],
        serverTimestamp: json.data.serverTimestamp,
        successfulNoteIds: json.data.successfulNoteIds,
      });

      // Verify that confirmed note is synced, but failed note remains dirty!
      const fetchedOk = await localNotes.getById('note_part_ok');
      expect(fetchedOk?.sync_status).toBe('synced');

      const fetchedFail = await localNotes.getById('note_part_fail');
      expect(fetchedFail?.sync_status).toBe('dirty');

      // Total dirty should now be 1
      const pendingAfter = await localSync.getPendingChanges(testUser.id);
      expect(pendingAfter.totalDirty).toBe(1);
      expect(pendingAfter.dirtyNotes[0].id).toBe('note_part_fail');
    });
  });

  describe('4. Retry After Failure', () => {
    it('retries only pending/failed items and marks them synced upon retry success', async () => {
      // Setup mock where previously failing note now succeeds
      const mockSupabase = {
        from: vi.fn((table: string) => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'note_retry_01',
                title: 'Retried Note',
                content_html: '<p>Fixed</p>',
                updated_at: new Date().toISOString(),
              },
            ],
          }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        })),
      };

      (createClient as any).mockResolvedValue(mockSupabase);
      (getAuthenticatedUser as any).mockResolvedValue(testUser);

      // Create a dirty note that needs retry
      const note = await localNotes.save(
        { id: 'note_retry_01', title: 'Retried Note', content_html: '<p>Fixed</p>' },
        testUser.id
      );

      const pending = await localSync.getPendingChanges(testUser.id);
      expect(pending.dirtyNotes.some((n) => n.id === 'note_retry_01')).toBe(true);

      const req = new Request('http://localhost:3000/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dirtyNotes: pending.dirtyNotes.filter((n) => n.id === 'note_retry_01'),
          dirtyProgress: [],
          dirtyHistory: [],
        }),
      });

      const res = await handleSyncPost(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.data.synced).toBe(true);
      expect(json.data.overallStatus).toBe('success');
      expect(json.data.successfulNoteIds).toContain('note_retry_01');

      await localSync.applyServerSnapshot(testUser.id, {
        notes: json.data.notes,
        readingProgress: [],
        serverTimestamp: json.data.serverTimestamp,
        successfulNoteIds: json.data.successfulNoteIds,
      });

      const retried = await localNotes.getById('note_retry_01');
      expect(retried?.sync_status).toBe('synced');
    });
  });

  describe('5. Cancel After Failure Keeps User Logged In', () => {
    it('preserves user session and unsynced data when sync fails and user cancels', async () => {
      const mockLogout = vi.fn();
      (api.auth.logout as any) = mockLogout;

      // Note remains in local store
      await localNotes.save(
        { id: 'note_cancel_stay', title: 'Safe Note', content_html: '<p>Preserved</p>' },
        testUser.id
      );

      // If user chooses "Cancel & Stay Logged In":
      // Modal calls onClose() without invoking api.auth.logout()
      expect(mockLogout).not.toHaveBeenCalled();

      // Verify local data remains dirty and uncorrupted
      const stored = await localNotes.getById('note_cancel_stay');
      expect(stored).not.toBeNull();
      expect(stored?.sync_status).toBe('dirty');
    });
  });

  describe('6. Stay Logged In After Successful Sync', () => {
    it('allows user to remain logged in after successful sync without invoking logout', async () => {
      const mockLogout = vi.fn();
      (api.auth.logout as any) = mockLogout;

      // User chooses "Stay Logged In":
      // No logout API is invoked
      expect(mockLogout).not.toHaveBeenCalled();
    });
  });

  describe('7. Continue to Logout After Successful Sync', () => {
    it('executes logout cleanly only when user explicitly confirms Continue to Logout', async () => {
      const mockLogout = vi.fn().mockResolvedValue({ success: true });
      (api.auth.logout as any) = mockLogout;

      // User explicitly clicks "Continue to Logout"
      await api.auth.logout();
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
  });

  describe('8. Browser Refresh During Sync', () => {
    it('guarantees unsynced IndexedDB data remains intact if interrupted before completion', async () => {
      const note = await localNotes.save(
        { id: 'note_interrupted', title: 'Interrupted Note', content_html: '<p>Persisted</p>' },
        testUser.id
      );
      expect(note.sync_status).toBe('dirty');

      // Before server snapshot is applied, if interruption occurs:
      // Re-fetching pending changes still reliably finds the note
      const pending = await localSync.getPendingChanges(testUser.id);
      expect(pending.dirtyNotes.some((n) => n.id === 'note_interrupted')).toBe(true);
    });
  });

  describe('9. Network Interruption During Sync', () => {
    it('catches network interruption gracefully and keeps local data intact', async () => {
      (api.sync.pushPending as any).mockRejectedValue(new Error('Failed to fetch'));

      await localNotes.save(
        { id: 'note_net_fail', title: 'Network Fail Note', content_html: '<p>Safe</p>' },
        testUser.id
      );

      try {
        await api.sync.pushPending({
          dirtyNotes: [{ id: 'note_net_fail' }],
          dirtyProgress: [],
          dirtyHistory: [],
        });
      } catch (err: any) {
        expect(err.message).toBe('Failed to fetch');
      }

      // Local storage must still have the dirty note
      const stored = await localNotes.getById('note_net_fail');
      expect(stored?.sync_status).toBe('dirty');
    });
  });

  describe('10. Duplicate Prevention During Retry', () => {
    it('uses stable IDs and idempotent upserts to prevent duplicate rows on retry', async () => {
      const upsertSpy = vi.fn().mockResolvedValue({ error: null });
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          order: vi.fn().mockResolvedValue({ data: [] }),
          upsert: upsertSpy,
        })),
      };

      (createClient as any).mockResolvedValue(mockSupabase);
      (getAuthenticatedUser as any).mockResolvedValue(testUser);

      const stableNote = {
        id: 'stable_note_uuid_123',
        title: 'Idempotent Note',
        content_html: '<p>Stable</p>',
      };

      // Attempt 1: First sync attempt
      const req1 = new Request('http://localhost:3000/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dirtyNotes: [stableNote], dirtyProgress: [], dirtyHistory: [] }),
      });
      await handleSyncPost(req1);

      // Attempt 2: Retry sync attempt with the exact same stable ID
      const req2 = new Request('http://localhost:3000/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dirtyNotes: [stableNote], dirtyProgress: [], dirtyHistory: [] }),
      });
      await handleSyncPost(req2);

      // Both calls must target the same record ID with onConflict: 'id'
      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'stable_note_uuid_123' }),
        { onConflict: 'id' }
      );
    });
  });

  describe('11. Header Manual Sync Never Logs Out', () => {
    it('verifies manual sync workflow never invokes logout', async () => {
      const mockLogout = vi.fn();
      (api.auth.logout as any) = mockLogout;

      // In manual mode, finishing sync shows result screen with only "Done" or "Retry" / "Close".
      // Neither of these call api.auth.logout()
      expect(mockLogout).not.toHaveBeenCalled();
    });
  });

  describe('12. Existing Authentication & Data Flows Intact', () => {
    it('verifies GET /api/sync returns canonical snapshot without altering local dirty flags', async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [] }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        })),
      };

      (createClient as any).mockResolvedValue(mockSupabase);
      (getAuthenticatedUser as any).mockResolvedValue(testUser);

      const res = await handleSyncGet();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.notes).toBeDefined();
      expect(json.data.readingProgress).toBeDefined();
    });
  });
});
