import { SupabaseClient } from '@supabase/supabase-js';
import { ReadingProgress, Document } from '../types/database';

export async function getReadingProgress(
  supabase: SupabaseClient,
  userId: string,
  documentId?: string
): Promise<{ progress: ReadingProgress; document?: Document }[]> {
  let query = supabase
    .from('reading_progress')
    .select(`
      *,
      documents:document_id (*)
    `)
    .eq('user_id', userId)
    .order('last_read_at', { ascending: false });

  if (documentId) {
    query = query.eq('document_id', documentId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching reading progress:', error);
    throw new Error(error.message);
  }

  return (data || []).map((row: any) => ({
    progress: {
      id: row.id,
      user_id: row.user_id,
      document_id: row.document_id,
      current_page: row.current_page,
      total_pages: row.total_pages,
      percentage: Number(row.percentage) || 0,
      zoom_level: Number(row.zoom_level) || 1.0,
      view_mode: row.view_mode || 'single',
      crop_settings: row.crop_settings,
      active_seconds: row.active_seconds || 0,
      last_read_at: row.last_read_at,
    },
    document: row.documents as Document | undefined,
  }));
}

export async function upsertReadingProgress(
  supabase: SupabaseClient,
  data: {
    document_id: string;
    current_page: number;
    total_pages: number;
    percentage?: number;
    zoom_level?: number;
    view_mode?: 'single' | 'double' | 'continuous';
    crop_settings?: any;
    active_seconds?: number;
  },
  userId: string
): Promise<ReadingProgress> {
  const percentage =
    typeof data.percentage === 'number'
      ? data.percentage
      : data.total_pages > 0
      ? Math.round((data.current_page / data.total_pages) * 100 * 100) / 100
      : 0;

  // Check if existing record exists to accumulate active_seconds
  const { data: existing } = await supabase
    .from('reading_progress')
    .select('active_seconds')
    .eq('user_id', userId)
    .eq('document_id', data.document_id)
    .maybeSingle();

  const currentActiveSeconds = existing?.active_seconds || 0;
  const newActiveSeconds = currentActiveSeconds + (data.active_seconds || 0);

  const payload = {
    user_id: userId,
    document_id: data.document_id,
    current_page: data.current_page,
    total_pages: data.total_pages,
    percentage,
    zoom_level: data.zoom_level || 1.0,
    view_mode: data.view_mode || 'single',
    crop_settings: data.crop_settings || null,
    active_seconds: newActiveSeconds,
    last_read_at: new Date().toISOString(),
  };

  const { data: result, error } = await supabase
    .from('reading_progress')
    .upsert(payload, { onConflict: 'user_id, document_id' })
    .select('*')
    .single();

  if (error || !result) {
    throw new Error(error?.message || 'Failed to upsert reading progress');
  }

  return {
    ...result,
    percentage: Number(result.percentage) || 0,
    zoom_level: Number(result.zoom_level) || 1.0,
  } as ReadingProgress;
}
