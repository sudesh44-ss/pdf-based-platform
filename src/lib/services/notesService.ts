import { SupabaseClient } from '@supabase/supabase-js';
import { Note } from '../types/database';

export interface NoteFilterOptions {
  documentId?: string;
  notebookId?: string;
  search?: string;
  isFavorite?: boolean;
}

export async function getNotes(
  supabase: SupabaseClient,
  userId: string,
  options: NoteFilterOptions = {}
): Promise<Note[]> {
  let query = supabase
    .from('notes')
    .select(`
      *,
      documents:document_id (title),
      notebooks:notebook_id (title)
    `)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (options.documentId) {
    query = query.eq('document_id', options.documentId);
  }
  if (options.notebookId) {
    query = query.eq('notebook_id', options.notebookId);
  }
  if (typeof options.isFavorite === 'boolean') {
    query = query.eq('is_favorite', options.isFavorite);
  }
  if (options.search && options.search.trim()) {
    const term = `%${options.search.trim()}%`;
    query = query.or(`title.ilike.${term},content_html.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching notes:', error);
    throw new Error(error.message);
  }

  return (data || []).map((row: any) => ({
    ...row,
    document_title: row.documents?.title || undefined,
    notebook_title: row.notebooks?.title || undefined,
  })) as Note[];
}

export async function getNoteById(
  supabase: SupabaseClient,
  id: string,
  userId: string
): Promise<Note | null> {
  const { data, error } = await supabase
    .from('notes')
    .select(`
      *,
      documents:document_id (title),
      notebooks:notebook_id (title)
    `)
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    ...data,
    document_title: data.documents?.title || undefined,
    notebook_title: data.notebooks?.title || undefined,
  } as Note;
}

export async function createNote(
  supabase: SupabaseClient,
  data: Partial<Note> & { title: string },
  userId: string
): Promise<Note> {
  const payload = {
    user_id: userId,
    notebook_id: data.notebook_id || null,
    document_id: data.document_id || null,
    page_number: data.page_number || null,
    title: data.title.trim() || 'Untitled Note',
    content_json: data.content_json || { type: 'doc', content: [] },
    content_html: data.content_html || '',
    tags: data.tags || [],
    is_favorite: Boolean(data.is_favorite),
    selected_text: data.selected_text || null,
    highlight_coords: data.highlight_coords || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: created, error } = await supabase
    .from('notes')
    .insert(payload)
    .select('*')
    .single();

  if (error || !created) {
    throw new Error(error?.message || 'Failed to create note');
  }

  return created as Note;
}

export async function updateNote(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<Note>,
  userId: string
): Promise<Note | null> {
  const existing = await getNoteById(supabase, id, userId);
  if (!existing) return null;

  const payload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof updates.title === 'string') payload.title = updates.title.trim();
  if (typeof updates.content_html === 'string') payload.content_html = updates.content_html;
  if (typeof updates.content_json !== 'undefined') payload.content_json = updates.content_json;
  if (Array.isArray(updates.tags)) payload.tags = updates.tags;
  if (typeof updates.is_favorite === 'boolean') payload.is_favorite = updates.is_favorite;
  if (typeof updates.notebook_id !== 'undefined') payload.notebook_id = updates.notebook_id;
  if (typeof updates.document_id !== 'undefined') payload.document_id = updates.document_id;
  if (typeof updates.page_number !== 'undefined') payload.page_number = updates.page_number;
  if (typeof updates.selected_text !== 'undefined') payload.selected_text = updates.selected_text;
  if (typeof updates.highlight_coords !== 'undefined') payload.highlight_coords = updates.highlight_coords;

  const { data, error } = await supabase
    .from('notes')
    .update(payload)
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update note');
  }

  return data as Note;
}

export async function deleteNote(
  supabase: SupabaseClient,
  id: string,
  userId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message);
  }

  return true;
}
