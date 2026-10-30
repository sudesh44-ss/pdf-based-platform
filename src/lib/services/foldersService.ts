import { SupabaseClient } from '@supabase/supabase-js';
import { Folder } from '../types/database';

export async function getFolders(
  supabase: SupabaseClient,
  userId: string
): Promise<Folder[]> {
  const { data, error } = await supabase
    .from('folders')
    .select(`
      *,
      document_folders:document_folders (document_id)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching folders:', error);
    throw new Error(error.message);
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    created_at: row.created_at,
    updated_at: row.updated_at,
    document_count: Array.isArray(row.document_folders) ? row.document_folders.length : 0,
  })) as Folder[];
}

export async function getFolderById(
  supabase: SupabaseClient,
  id: string,
  userId: string
): Promise<Folder | null> {
  const { data, error } = await supabase
    .from('folders')
    .select(`
      *,
      document_folders:document_folders (document_id)
    `)
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    user_id: data.user_id,
    name: data.name,
    color: data.color,
    icon: data.icon,
    created_at: data.created_at,
    updated_at: data.updated_at,
    document_count: Array.isArray(data.document_folders) ? data.document_folders.length : 0,
  } as Folder;
}

export async function createFolder(
  supabase: SupabaseClient,
  data: { name: string; color?: string; icon?: string },
  userId: string
): Promise<Folder> {
  const payload = {
    user_id: userId,
    name: data.name.trim(),
    color: data.color || '#3b82f6',
    icon: data.icon || 'folder',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: created, error } = await supabase
    .from('folders')
    .insert(payload)
    .select('*')
    .single();

  if (error || !created) {
    throw new Error(error?.message || 'Failed to create folder');
  }

  return { ...created, document_count: 0 } as Folder;
}

export async function updateFolder(
  supabase: SupabaseClient,
  id: string,
  updates: { name?: string; color?: string; icon?: string },
  userId: string
): Promise<Folder | null> {
  const payload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof updates.name === 'string') payload.name = updates.name.trim();
  if (typeof updates.color === 'string') payload.color = updates.color;
  if (typeof updates.icon === 'string') payload.icon = updates.icon;

  const { data, error } = await supabase
    .from('folders')
    .update(payload)
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update folder');
  }

  return data as Folder;
}

export async function deleteFolder(
  supabase: SupabaseClient,
  id: string,
  userId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('folders')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
  return true;
}

export async function addDocumentToFolder(
  supabase: SupabaseClient,
  folderId: string,
  documentId: string,
  userId: string
): Promise<boolean> {
  // Verify folder belongs to user
  const folder = await getFolderById(supabase, folderId, userId);
  if (!folder) throw new Error('FOLDER_NOT_FOUND');

  const { error } = await supabase
    .from('document_folders')
    .upsert({ folder_id: folderId, document_id: documentId, created_at: new Date().toISOString() });

  if (error) throw new Error(error.message);
  return true;
}

export async function removeDocumentFromFolder(
  supabase: SupabaseClient,
  folderId: string,
  documentId: string,
  userId: string
): Promise<boolean> {
  const folder = await getFolderById(supabase, folderId, userId);
  if (!folder) throw new Error('FOLDER_NOT_FOUND');

  const { error } = await supabase
    .from('document_folders')
    .delete()
    .eq('folder_id', folderId)
    .eq('document_id', documentId);

  if (error) throw new Error(error.message);
  return true;
}
