import { SupabaseClient } from '@supabase/supabase-js';
import { Annotation } from '../types/database';

export async function getAnnotations(
  supabase: SupabaseClient,
  userId: string,
  documentId: string,
  pageNumber?: number
): Promise<Annotation[]> {
  let query = supabase
    .from('annotations')
    .select('*')
    .eq('user_id', userId)
    .eq('document_id', documentId)
    .order('created_at', { ascending: true });

  if (typeof pageNumber === 'number') {
    query = query.eq('page_number', pageNumber);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching annotations:', error);
    throw new Error(error.message);
  }

  return (data || []) as Annotation[];
}

export async function createAnnotation(
  supabase: SupabaseClient,
  data: {
    document_id: string;
    page_number: number;
    type: 'highlight' | 'underline' | 'note' | 'box' | 'freehand';
    color?: string;
    rects?: any[];
    content?: string | null;
  },
  userId: string
): Promise<Annotation> {
  const payload = {
    user_id: userId,
    document_id: data.document_id,
    page_number: data.page_number,
    type: data.type,
    color: data.color || '#fef08a',
    rects: data.rects || [],
    content: data.content || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: created, error } = await supabase
    .from('annotations')
    .insert(payload)
    .select('*')
    .single();

  if (error || !created) {
    throw new Error(error?.message || 'Failed to create annotation');
  }

  return created as Annotation;
}

export async function updateAnnotation(
  supabase: SupabaseClient,
  id: string,
  updates: { color?: string; rects?: any[]; content?: string | null },
  userId: string
): Promise<Annotation | null> {
  const payload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof updates.color === 'string') payload.color = updates.color;
  if (Array.isArray(updates.rects)) payload.rects = updates.rects;
  if (typeof updates.content !== 'undefined') payload.content = updates.content;

  const { data, error } = await supabase
    .from('annotations')
    .update(payload)
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update annotation');
  }

  return data as Annotation;
}

export async function deleteAnnotation(
  supabase: SupabaseClient,
  id: string,
  userId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('annotations')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
  return true;
}
