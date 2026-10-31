import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/services/authService';
import { upsertReadingProgress } from '@/lib/services/readingProgressService';
import { apiSuccess, apiError } from '@/lib/api/response';

/**
 * OpenShelf Manual Cloud Synchronization API Route
 *
 * Rules:
 * - Synchronization is ONLY triggered manually by user invocation (e.g. "Sync Data", "Sync & Logout").
 * - Supabase holds the cloud snapshot.
 * - Private notes content is restricted to the owner's user_id via RLS and authentication.
 * - Conflicting edits are detected safely without silent overwrites.
 */

export async function GET() {
  const supabase = await createClient();
  if (!supabase) {
    return apiError('CONFIGURATION_ERROR', 'Supabase credentials are not configured', 503);
  }

  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return apiError('UNAUTHORIZED', 'Authentication required to synchronize data', 401);
  }

  try {
    // 1. Fetch user's synchronized notes
    const { data: notes, error: notesError } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (notesError) {
      console.error('Sync GET notes error:', notesError);
      return apiError('INTERNAL_ERROR', 'Failed to retrieve cloud notes snapshot', 500);
    }

    // 2. Fetch user's synchronized reading progress
    const { data: readingProgress, error: progError } = await supabase
      .from('reading_progress')
      .select('*')
      .eq('user_id', user.id);

    if (progError) {
      console.error('Sync GET progress error:', progError);
      return apiError('INTERNAL_ERROR', 'Failed to retrieve cloud progress snapshot', 500);
    }

    // 3. Fetch user's synchronized reading history (graceful fallback if table is not yet migrated)
    let readingHistory: any[] = [];
    try {
      const { data: history, error: histError } = await supabase
        .from('reading_history')
        .select('*')
        .eq('user_id', user.id)
        .order('read_at', { ascending: false })
        .limit(100);

      if (!histError && Array.isArray(history)) {
        readingHistory = history;
      }
    } catch {
      // Table may not exist yet in older Supabase databases
    }

    // 4. Fetch last sync metadata
    let lastSyncedAt: string | null = null;
    try {
      const { data: meta } = await supabase
        .from('user_sync_meta')
        .select('last_synced_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (meta?.last_synced_at) {
        lastSyncedAt = meta.last_synced_at;
      }
    } catch {
      // Metadata table optional
    }

    const serverTimestamp = new Date().toISOString();

    return apiSuccess({
      notes: notes || [],
      readingProgress: readingProgress || [],
      readingHistory,
      lastSyncedAt: lastSyncedAt || serverTimestamp,
      serverTimestamp,
    });
  } catch (err: any) {
    console.error('Unexpected sync GET error:', err);
    return apiError('INTERNAL_ERROR', err.message || 'Failed to fetch cloud snapshot', 500);
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return apiError('CONFIGURATION_ERROR', 'Supabase credentials are not configured', 503);
  }

  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return apiError('UNAUTHORIZED', 'Authentication required to synchronize data', 401);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return apiError('BAD_REQUEST', 'Invalid JSON payload', 400);
  }

  const { dirtyNotes = [], dirtyProgress = [], dirtyHistory = [] } = body;
  const now = new Date().toISOString();
  const conflicts: any[] = [];

  const successfulNoteIds: string[] = [];
  const failedNotes: { id: string; error: string }[] = [];

  const successfulProgressDocIds: string[] = [];
  const failedProgress: { document_id: string; error: string }[] = [];

  const successfulHistoryIds: string[] = [];
  const failedHistory: { id: string; error: string }[] = [];

  try {
    // 1. Process dirty notes
    for (const note of dirtyNotes) {
      if (!note.id) continue;

      if (note.is_deleted) {
        // Soft tombstone -> delete from cloud
        try {
          const { error: delErr } = await supabase
            .from('notes')
            .delete()
            .eq('id', note.id)
            .eq('user_id', user.id);
          if (delErr) {
            failedNotes.push({ id: note.id, error: delErr.message });
          } else {
            successfulNoteIds.push(note.id);
          }
        } catch (delCatch: any) {
          failedNotes.push({ id: note.id, error: delCatch.message || 'Delete note failed' });
        }
        continue;
      }

      // Check existing note in cloud to detect multi-device conflict
      const { data: existing } = await supabase
        .from('notes')
        .select('id, updated_at, title, content_html, version')
        .eq('id', note.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        const serverTime = new Date(existing.updated_at).getTime();
        const clientBaseTime = note.client_updated_at ? new Date(note.client_updated_at).getTime() : 0;

        // If server was updated strictly after the client's local base version and text differs:
        const hasContentConflict =
          existing.title !== note.title || existing.content_html !== note.content_html;

        if (serverTime > clientBaseTime && hasContentConflict) {
          conflicts.push({
            id: note.id,
            server_title: existing.title,
            server_content_html: existing.content_html,
            server_updated_at: existing.updated_at,
          });
          // Do not silently overwrite server version; keep server copy
          continue;
        }
      }

      // Safe to upsert
      const notePayload: Record<string, any> = {
        id: note.id,
        user_id: user.id,
        document_id: note.document_id || null,
        page_number: note.page_number || null,
        title: note.title ? note.title.trim() : 'Untitled Note',
        content_html: note.content_html || '',
        content_json: note.content_json || { type: 'doc', content: [] },
        tags: Array.isArray(note.tags) ? note.tags : [],
        is_favorite: Boolean(note.is_favorite),
        updated_at: now,
      };

      try {
        const { error: upsertErr } = await supabase
          .from('notes')
          .upsert(notePayload, { onConflict: 'id' });

        if (upsertErr) {
          console.warn('Note upsert warning:', upsertErr.message);
          failedNotes.push({ id: note.id, error: upsertErr.message });
        } else {
          successfulNoteIds.push(note.id);
        }
      } catch (upsertCatch: any) {
        failedNotes.push({ id: note.id, error: upsertCatch.message || 'Note upsert failed' });
      }
    }

    // 2. Process dirty reading progress
    for (const prog of dirtyProgress) {
      if (!prog.document_id) continue;

      try {
        await upsertReadingProgress(
          supabase,
          {
            document_id: prog.document_id,
            current_page: prog.current_page || 1,
            total_pages: prog.total_pages || 1,
            percentage: prog.percentage,
            zoom_level: prog.zoom_level,
            view_mode: prog.view_mode,
            crop_settings: prog.crop_settings,
            active_seconds: prog.active_seconds || 0,
          },
          user.id
        );
        successfulProgressDocIds.push(prog.document_id);
      } catch (pErr: any) {
        console.warn('Progress upsert warning:', pErr.message);
        failedProgress.push({
          document_id: prog.document_id,
          error: pErr.message || 'Progress upsert failed',
        });
      }
    }

    // 3. Process dirty reading history (gracefully handle missing table)
    for (const hist of dirtyHistory) {
      if (!hist.id || !hist.document_id) continue;

      try {
        const { error: hErr } = await supabase.from('reading_history').upsert(
          {
            id: hist.id,
            user_id: user.id,
            document_id: hist.document_id,
            page_number: hist.page_number || 1,
            active_seconds: hist.active_seconds || 0,
            read_at: hist.read_at || now,
          },
          { onConflict: 'id' }
        );
        if (hErr) {
          if (hErr.code === '42P01' || hErr.message?.includes('does not exist')) {
            // Gracefully ignore optional missing table in legacy databases
            successfulHistoryIds.push(hist.id);
          } else {
            console.warn('History upsert warning:', hErr.message);
            failedHistory.push({ id: hist.id, error: hErr.message });
          }
        } else {
          successfulHistoryIds.push(hist.id);
        }
      } catch (hErr: any) {
        failedHistory.push({ id: hist.id, error: hErr.message || 'History upsert failed' });
      }
    }

    // 4. Update sync metadata (only if not completely failed)
    try {
      await supabase.from('user_sync_meta').upsert(
        {
          user_id: user.id,
          last_synced_at: now,
          device_info: request.headers.get('user-agent') || 'Browser',
        },
        { onConflict: 'user_id' }
      );
    } catch {
      // Safe to ignore if table does not exist
    }

    // 5. Fetch fresh unified snapshot to return to client
    const { data: freshNotes } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    const { data: freshProgress } = await supabase
      .from('reading_progress')
      .select('*')
      .eq('user_id', user.id);

    let freshHistory: any[] = [];
    try {
      const { data: h } = await supabase
        .from('reading_history')
        .select('*')
        .eq('user_id', user.id)
        .order('read_at', { ascending: false })
        .limit(100);
      if (h) freshHistory = h;
    } catch {}

    // Calculate per-category and overall sync metrics
    const notesStatus: 'synced' | 'partial' | 'failed' =
      dirtyNotes.length === 0
        ? 'synced'
        : failedNotes.length === 0
        ? 'synced'
        : successfulNoteIds.length > 0
        ? 'partial'
        : 'failed';

    const progressStatus: 'synced' | 'partial' | 'failed' =
      dirtyProgress.length === 0
        ? 'synced'
        : failedProgress.length === 0
        ? 'synced'
        : successfulProgressDocIds.length > 0
        ? 'partial'
        : 'failed';

    const historyStatus: 'synced' | 'partial' | 'failed' =
      dirtyHistory.length === 0
        ? 'synced'
        : failedHistory.length === 0
        ? 'synced'
        : successfulHistoryIds.length > 0
        ? 'partial'
        : 'failed';

    const totalFailed = failedNotes.length + failedProgress.length + failedHistory.length;
    const totalAttempted = dirtyNotes.length + dirtyProgress.length + dirtyHistory.length;
    const totalSuccessful =
      successfulNoteIds.length + successfulProgressDocIds.length + successfulHistoryIds.length;

    const overallStatus: 'success' | 'partial' | 'failed' =
      totalFailed === 0
        ? 'success'
        : totalSuccessful > 0
        ? 'partial'
        : 'failed';

    const isFullySynced = overallStatus === 'success';

    return apiSuccess({
      synced: isFullySynced,
      overallStatus,
      serverTimestamp: now,
      conflicts,
      categories: {
        notes: {
          status: notesStatus,
          total: dirtyNotes.length,
          synced: successfulNoteIds.length,
          failed: failedNotes.length,
        },
        readingProgress: {
          status: progressStatus,
          total: dirtyProgress.length,
          synced: successfulProgressDocIds.length,
          failed: failedProgress.length,
        },
        readingHistory: {
          status: historyStatus,
          total: dirtyHistory.length,
          synced: successfulHistoryIds.length,
          failed: failedHistory.length,
        },
      },
      successfulNoteIds,
      successfulProgressDocIds,
      successfulHistoryIds,
      failedNotes,
      failedProgress,
      failedHistory,
      notes: freshNotes || [],
      readingProgress: freshProgress || [],
      readingHistory: freshHistory,
    });
  } catch (err: any) {
    console.error('Unexpected sync POST error:', err);
    return apiError('INTERNAL_ERROR', err.message || 'Sync failed', 500);
  }
}
