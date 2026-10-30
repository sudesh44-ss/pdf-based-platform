import { SupabaseClient } from '@supabase/supabase-js';
import { Notebook } from '../types/database';

export async function getNotebooks(
  supabase: SupabaseClient,
  userId: string
): Promise<Notebook[]> {
  const { data, error } = await supabase
    .from('notebooks')
    .select(`
      *,
      notes:notes (id)
    `)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching notebooks:', error);
    throw new Error(error.message);
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    description: row.description,
    color: row.color,
    is_favorite: row.is_favorite,
    created_at: row.created_at,
    updated_at: row.updated_at,
    note_count: Array.isArray(row.notes) ? row.notes.length : 0,
  })) as Notebook[];
}

export async function getNotebookById(
  supabase: SupabaseClient,
  id: string,
  userId: string
): Promise<Notebook | null> {
  const { data, error } = await supabase
    .from('notebooks')
    .select(`
      *,
      notes:notes (id)
    `)
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    user_id: data.user_id,
    title: data.title,
    description: data.description,
    color: data.color,
    is_favorite: data.is_favorite,
    created_at: data.created_at,
    updated_at: data.updated_at,
    note_count: Array.isArray(data.notes) ? data.notes.length : 0,
  } as Notebook;
}

export async function createNotebook(
  supabase: SupabaseClient,
  data: { title: string; description?: string; color?: string; is_favorite?: boolean },
  userId: string
): Promise<Notebook> {
  const payload = {
    user_id: userId,
    title: data.title.trim(),
    description: data.description?.trim() || '',
    color: data.color || '#8b5cf6',
    is_favorite: Boolean(data.is_favorite),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: created, error } = await supabase
    .from('notebooks')
    .insert(payload)
    .select('*')
    .single();

  if (error || !created) {
    throw new Error(error?.message || 'Failed to create notebook');
  }

  return { ...created, note_count: 0 } as Notebook;
}

export async function updateNotebook(
  supabase: SupabaseClient,
  id: string,
  updates: { title?: string; description?: string; color?: string; is_favorite?: boolean },
  userId: string
): Promise<Notebook | null> {
  const payload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof updates.title === 'string') payload.title = updates.title.trim();
  if (typeof updates.description === 'string') payload.description = updates.description.trim();
  if (typeof updates.color === 'string') payload.color = updates.color;
  if (typeof updates.is_favorite === 'boolean') payload.is_favorite = updates.is_favorite;

  const { data, error } = await supabase
    .from('notebooks')
    .update(payload)
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update notebook');
  }

  return data as Notebook;
}

export async function deleteNotebook(
  supabase: SupabaseClient,
  id: string,
  userId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('notebooks')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
  return true;
}
