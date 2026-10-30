import { SupabaseClient } from '@supabase/supabase-js';
import { Bookmark } from '../types/database';

export async function getBookmarks(
  supabase: SupabaseClient,
  userId: string,
  documentId?: string
): Promise<Bookmark[]> {
  let query = supabase
    .from('bookmarks')
    .select(`
      *,
      documents:document_id (title)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (documentId) {
    query = query.eq('document_id', documentId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching bookmarks:', error);
    throw new Error(error.message);
  }

  return (data || []).map((row: any) => ({
    ...row,
    document_title: row.documents?.title || undefined,
  })) as Bookmark[];
}

export async function createBookmark(
  supabase: SupabaseClient,
  data: { document_id: string; page_number: number; title?: string; color?: string },
  userId: string
): Promise<Bookmark> {
  const payload = {
    user_id: userId,
    document_id: data.document_id,
    page_number: data.page_number,
    title: data.title?.trim() || null,
    color: data.color || '#3b82f6',
    created_at: new Date().toISOString(),
  };

  const { data: created, error } = await supabase
    .from('bookmarks')
    .upsert(payload, { onConflict: 'user_id, document_id, page_number' })
    .select('*')
    .single();

  if (error || !created) {
    throw new Error(error?.message || 'Failed to create bookmark');
  }

  return created as Bookmark;
}

export async function deleteBookmark(
  supabase: SupabaseClient,
  id: string,
  userId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('bookmarks')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
  return true;
}

export async function deleteBookmarkByDocPage(
  supabase: SupabaseClient,
  documentId: string,
  pageNumber: number,
  userId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('bookmarks')
    .delete()
    .eq('document_id', documentId)
    .eq('page_number', pageNumber)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
  return true;
}
