import { SupabaseClient } from '@supabase/supabase-js';
import { Document } from '../types/database';

export interface DocumentQueryOptions {
  isPublic?: boolean;
  userId?: string;
  search?: string;
  category?: string;
  folderId?: string;
  page?: number;
  limit?: number;
  sort?: 'created_at' | 'title' | 'likes_count' | 'views_count' | 'page_count';
  order?: 'asc' | 'desc';
  includeTrash?: boolean;
}

export interface PaginatedResult<T> {
  documents: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function getDocuments(
  supabase: SupabaseClient,
  options: DocumentQueryOptions = {}
): Promise<PaginatedResult<Document>> {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || 20));
  const offset = (page - 1) * limit;

  let query = supabase.from('documents').select('*', { count: 'exact' });

  // Public vs Private library filters
  if (options.isPublic) {
    query = query.eq('is_public', true).eq('status', 'published').eq('is_trash', false);
  } else if (options.userId) {
    query = query.eq('user_id', options.userId);
    if (!options.includeTrash) {
      query = query.eq('is_trash', false);
    }
  }

  // Category filter
  if (options.category && options.category !== 'all') {
    query = query.contains('categories', [options.category]);
  }

  // Text search filter
  if (options.search && options.search.trim()) {
    const term = `%${options.search.trim()}%`;
    query = query.or(`title.ilike.${term},description.ilike.${term}`);
  }

  // Sorting
  const sortField = options.sort || 'created_at';
  const sortOrder = options.order || 'desc';
  query = query.order(sortField, { ascending: sortOrder === 'asc' });

  // Pagination
  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) {
    console.error('Error fetching documents:', error);
    throw new Error(error.message);
  }

  const total = count || 0;
  const docs = (data || []) as Document[];

  return {
    documents: docs,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

export async function getDocumentById(
  supabase: SupabaseClient,
  id: string,
  userId?: string,
  isAdmin?: boolean
): Promise<Document | null> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const doc = data as Document;

  // Authorization check
  const isOwner = userId && doc.user_id === userId;
  const isAccessiblePublic = doc.is_public && doc.status === 'published' && !doc.is_trash;

  if (!isAccessiblePublic && !isOwner && !isAdmin) {
    return null;
  }

  // Check if liked or favorited by current user
  if (userId) {
    try {
      const [likeRes, favRes] = await Promise.all([
        supabase.from('likes').select('id').eq('document_id', id).eq('user_id', userId).maybeSingle(),
        supabase.from('favourites').select('id').eq('document_id', id).eq('user_id', userId).maybeSingle(),
      ]);
      doc.is_liked = Boolean(likeRes?.data);
      doc.is_favorite = Boolean(favRes?.data);
    } catch {
      // Non-critical, ignore if tables/methods not configured
    }
  }

  return doc;
}

export async function createDocument(
  supabase: SupabaseClient,
  docData: Partial<Document> & { title: string; file_name: string; file_size: number; user_id: string }
): Promise<Document> {
  const payload = {
    user_id: docData.user_id,
    title: docData.title.trim(),
    description: docData.description?.trim() || '',
    file_name: docData.file_name,
    file_size: docData.file_size,
    file_hash: docData.file_hash || null,
    mime_type: docData.mime_type || 'application/pdf',
    page_count: docData.page_count || 1,
    cover_image_url: docData.cover_image_url || null,
    storage_type: docData.storage_type || 'telegram',
    storage_file_id: docData.storage_file_id || null,
    storage_file_path: docData.storage_file_path || '/samples/sample-study-guide.pdf',
    is_public: Boolean(docData.is_public),
    status: docData.is_public ? 'pending_review' : 'published',
    categories: docData.categories || [],
    tags: docData.tags || [],
    likes_count: 0,
    views_count: 0,
    is_trash: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('documents')
    .insert(payload)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create document record');
  }

  return data as Document;
}

export async function updateDocument(
  supabase: SupabaseClient,
  id: string,
  updates: {
    title?: string;
    description?: string;
    categories?: string[];
    tags?: string[];
    is_public?: boolean;
    is_trash?: boolean;
  },
  userId: string,
  isAdmin: boolean = false
): Promise<Document | null> {
  // 1. Fetch document directly to verify existence and ownership
  const { data: existing, error: fetchError } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (fetchError || !existing) return null;

  if (existing.user_id !== userId && !isAdmin) {
    throw new Error('FORBIDDEN');
  }

  // 2. Build sanitized payload protecting privileged fields
  const payload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof updates.title === 'string') payload.title = updates.title.trim();
  if (typeof updates.description === 'string') payload.description = updates.description.trim();
  if (Array.isArray(updates.categories)) payload.categories = updates.categories;
  if (Array.isArray(updates.tags)) payload.tags = updates.tags;
  if (typeof updates.is_public === 'boolean') payload.is_public = updates.is_public;
  if (typeof updates.is_trash === 'boolean') {
    payload.is_trash = updates.is_trash;
    payload.trashed_at = updates.is_trash ? new Date().toISOString() : null;
  }

  const { data, error } = await supabase
    .from('documents')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update document');
  }

  return data as Document;
}

export async function deleteDocument(
  supabase: SupabaseClient,
  id: string,
  userId: string,
  isAdmin: boolean = false,
  permanent: boolean = false
): Promise<boolean> {
  const { data: existing, error: fetchError } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (fetchError || !existing) return false;

  if (existing.user_id !== userId && !isAdmin) {
    throw new Error('FORBIDDEN');
  }

  if (permanent) {
    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  }

  // Soft-delete
  const { error } = await supabase
    .from('documents')
    .update({
      is_trash: true,
      trashed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw new Error(error.message);
  return true;
}

export async function toggleLike(
  supabase: SupabaseClient,
  documentId: string,
  userId: string,
  like: boolean
): Promise<{ liked: boolean; likesCount: number }> {
  if (like) {
    await supabase.from('likes').upsert({ user_id: userId, document_id: documentId });
  } else {
    await supabase.from('likes').delete().eq('user_id', userId).eq('document_id', documentId);
  }

  // Count accurate likes from database
  const { count } = await supabase
    .from('likes')
    .select('id', { count: 'exact', head: true })
    .eq('document_id', documentId);

  const likesCount = count || 0;

  // Sync back to documents table
  await supabase
    .from('documents')
    .update({ likes_count: likesCount })
    .eq('id', documentId);

  return { liked: like, likesCount };
}

export async function toggleFavourite(
  supabase: SupabaseClient,
  documentId: string,
  userId: string,
  favourite: boolean
): Promise<{ favourited: boolean }> {
  if (favourite) {
    await supabase.from('favourites').upsert({ user_id: userId, document_id: documentId });
  } else {
    await supabase.from('favourites').delete().eq('user_id', userId).eq('document_id', documentId);
  }

  return { favourited: favourite };
}
