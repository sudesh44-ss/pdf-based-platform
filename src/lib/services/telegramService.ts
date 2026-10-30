import { getAdminClient } from '@/lib/supabase/admin';
import { TelegramUpload, TelegramUploadStatus, Document } from '@/lib/types/database';
import { telegramClient } from '@/lib/telegram/client';
import { logAdminActivity } from '@/lib/auth/adminAuth';

export interface TelegramWebhookDocData {
  chatId: number;
  messageId: number;
  fileId: string;
  fileUniqueId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  caption?: string;
  chatTitle?: string;
}

/**
 * Validates whether a Telegram chat/channel ID is on the configured allowlist.
 */
export function isChatIdAllowed(chatId: number | string): boolean {
  const allowed = (process.env.TELEGRAM_ALLOWED_CHAT_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // If no allowlist is configured in development, allow all
  if (allowed.length === 0) return true;

  const chatStr = String(chatId);
  return allowed.some((id) => id === chatStr);
}

/**
 * Ingests a validated PDF document received from Telegram webhook into the database.
 */
export async function registerTelegramUpload(
  doc: TelegramWebhookDocData
): Promise<{ success: boolean; upload?: TelegramUpload; error?: string; isDuplicate?: boolean }> {
  const adminClient = getAdminClient();
  if (!adminClient) {
    return { success: false, error: 'Database service client unavailable' };
  }

  // 1. Check for duplicates by (chat_id, message_id) or file_unique_id
  const { data: existing } = await adminClient
    .from('telegram_uploads')
    .select('*')
    .or(
      `and(telegram_chat_id.eq.${doc.chatId},telegram_message_id.eq.${doc.messageId}),telegram_file_unique_id.eq.${doc.fileUniqueId}`
    )
    .maybeSingle();

  if (existing) {
    return { success: true, upload: existing as TelegramUpload, isDuplicate: true };
  }

  // 2. Validate file size against Telegram 20MB Cloud API limit
  const MAX_TELEGRAM_CLOUD_BYTES = 20 * 1024 * 1024; // 20 MB
  let status: TelegramUploadStatus = 'pending';
  let failureReason: string | null = null;

  if (doc.fileSize > MAX_TELEGRAM_CLOUD_BYTES) {
    status = 'processing_failed';
    failureReason = `File size (${(doc.fileSize / (1024 * 1024)).toFixed(2)} MB) exceeds Telegram Cloud Bot API 20MB limit.`;
  }

  // Clean title from filename or caption
  const titleCandidate =
    doc.caption?.trim() ||
    doc.fileName.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ') ||
    'Untitled PDF Document';

  const newUploadPayload = {
    telegram_file_id: doc.fileId,
    telegram_file_unique_id: doc.fileUniqueId,
    telegram_chat_id: doc.chatId,
    telegram_message_id: doc.messageId,
    original_filename: doc.fileName,
    mime_type: doc.mimeType || 'application/pdf',
    file_size: doc.fileSize,
    title: titleCandidate,
    description: doc.caption || '',
    status,
    rejection_reason: failureReason,
    metadata: {
      source_chat_title: doc.chatTitle || null,
      received_at: new Date().toISOString(),
    },
  };

  const { data: created, error } = await adminClient
    .from('telegram_uploads')
    .insert(newUploadPayload)
    .select('*')
    .single();

  if (error || !created) {
    console.error('Error inserting telegram upload:', error);
    return { success: false, error: error?.message || 'Database insert failed' };
  }

  // Log activity
  await logAdminActivity('telegram_bot', 'pdf_received', 'upload', created.id, {
    file_name: doc.fileName,
    file_size: doc.fileSize,
    status,
  });

  return { success: true, upload: created as TelegramUpload };
}

/**
 * Retrieves uploads queue with filters and pagination.
 */
export async function getTelegramUploads(options: {
  status?: TelegramUploadStatus | 'all';
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ uploads: TelegramUpload[]; total: number; page: number; limit: number }> {
  const adminClient = getAdminClient();
  if (!adminClient) return { uploads: [], total: 0, page: 1, limit: 20 };

  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || 20));
  const offset = (page - 1) * limit;

  let query = adminClient.from('telegram_uploads').select('*', { count: 'exact' });

  if (options.status && options.status !== 'all') {
    query = query.eq('status', options.status);
  }

  if (options.search && options.search.trim()) {
    const term = `%${options.search.trim()}%`;
    query = query.or(`title.ilike.${term},original_filename.ilike.${term}`);
  }

  query = query.order('uploaded_at', { ascending: false }).range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) {
    console.error('Error fetching telegram uploads:', error);
    return { uploads: [], total: 0, page, limit };
  }

  return {
    uploads: (data || []) as TelegramUpload[],
    total: count || 0,
    page,
    limit,
  };
}

/**
 * Retrieves a single upload record by ID.
 */
export async function getUploadById(id: string): Promise<TelegramUpload | null> {
  const adminClient = getAdminClient();
  if (!adminClient) return null;

  const { data, error } = await adminClient
    .from('telegram_uploads')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  return data as TelegramUpload;
}

/**
 * Updates metadata for a pending upload.
 */
export async function updateUploadMetadata(
  id: string,
  updates: Partial<TelegramUpload>,
  adminUsername: string
): Promise<TelegramUpload | null> {
  const adminClient = getAdminClient();
  if (!adminClient) return null;

  const allowedFields = {
    title: updates.title?.trim(),
    description: updates.description?.trim(),
    category_id: updates.category_id,
    category_name: updates.category_name,
    tags: updates.tags,
    author: updates.author?.trim(),
    language: updates.language || 'en',
    publication_year: updates.publication_year,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await adminClient
    .from('telegram_uploads')
    .update(allowedFields)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    console.error('Failed to update upload metadata:', error);
    return null;
  }

  await logAdminActivity(adminUsername, 'metadata_updated', 'upload', id, updates);

  return data as TelegramUpload;
}

/**
 * Approves a Telegram upload and publishes it as a verified public document in the documents table.
 */
export async function approveAndPublishUpload(
  id: string,
  adminUsername: string
): Promise<{ success: boolean; upload?: TelegramUpload; document?: Document; error?: string }> {
  const adminClient = getAdminClient();
  if (!adminClient) return { success: false, error: 'Admin client unavailable' };

  const upload = await getUploadById(id);
  if (!upload) return { success: false, error: 'Upload not found' };

  if (upload.status === 'processing_failed') {
    return { success: false, error: 'Cannot approve upload that failed Telegram processing' };
  }

  // Idempotent: check if document already exists for this upload
  let documentId = upload.document_id;
  let docRecord: Document | null = null;

  const categoryArray = upload.category_name ? [upload.category_name] : ['General'];

  if (documentId) {
    // Update existing document to published
    const { data: updatedDoc, error: updateDocErr } = await adminClient
      .from('documents')
      .update({
        title: upload.title,
        description: upload.description,
        categories: categoryArray,
        tags: upload.tags || [],
        is_public: true,
        status: 'published',
        is_trash: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId)
      .select('*')
      .single();

    if (updateDocErr) {
      return { success: false, error: updateDocErr.message };
    }
    docRecord = updatedDoc as Document;
  } else {
    // Insert new document into documents table
    const { data: newDoc, error: createDocErr } = await adminClient
      .from('documents')
      .insert({
        title: upload.title,
        description: upload.description,
        file_name: upload.original_filename,
        file_size: upload.file_size,
        file_hash: upload.file_hash,
        mime_type: 'application/pdf',
        page_count: 1, // Will be updated on initial read or reader load
        storage_type: 'telegram',
        storage_file_id: upload.telegram_file_id,
        is_public: true,
        status: 'published',
        categories: categoryArray,
        tags: upload.tags || [],
      })
      .select('*')
      .single();

    if (createDocErr || !newDoc) {
      return { success: false, error: createDocErr?.message || 'Failed to create document record' };
    }

    docRecord = newDoc as Document;
    documentId = newDoc.id;
  }

  // Update upload status to published
  const now = new Date().toISOString();
  const { data: updatedUpload, error: updateUploadErr } = await adminClient
    .from('telegram_uploads')
    .update({
      status: 'published',
      document_id: documentId,
      reviewed_by: adminUsername,
      reviewed_at: now,
      published_at: now,
      rejection_reason: null,
      updated_at: now,
    })
    .eq('id', id)
    .select('*')
    .single();

  if (updateUploadErr) {
    return { success: false, error: updateUploadErr.message };
  }

  await logAdminActivity(adminUsername, 'pdf_approved', 'upload', id, {
    document_id: documentId,
    title: upload.title,
  });

  return { success: true, upload: updatedUpload as TelegramUpload, document: docRecord };
}

/**
 * Rejects a Telegram upload with an administrative reason.
 */
export async function rejectUpload(
  id: string,
  reason: string,
  adminUsername: string
): Promise<{ success: boolean; upload?: TelegramUpload; error?: string }> {
  const adminClient = getAdminClient();
  if (!adminClient) return { success: false, error: 'Admin client unavailable' };

  const upload = await getUploadById(id);
  if (!upload) return { success: false, error: 'Upload not found' };

  // If a published document was linked, hide it
  if (upload.document_id) {
    await adminClient
      .from('documents')
      .update({ status: 'rejected', is_public: false })
      .eq('id', upload.document_id);
  }

  const now = new Date().toISOString();
  const { data, error } = await adminClient
    .from('telegram_uploads')
    .update({
      status: 'rejected',
      rejection_reason: reason.trim() || 'Did not meet content quality or formatting criteria.',
      reviewed_by: adminUsername,
      reviewed_at: now,
      updated_at: now,
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    return { success: false, error: error?.message || 'Failed to update upload status' };
  }

  await logAdminActivity(adminUsername, 'pdf_rejected', 'upload', id, { reason });

  return { success: true, upload: data as TelegramUpload };
}

/**
 * Reopens a rejected or unpublished upload for re-review.
 */
export async function reopenUpload(
  id: string,
  adminUsername: string
): Promise<{ success: boolean; upload?: TelegramUpload; error?: string }> {
  const adminClient = getAdminClient();
  if (!adminClient) return { success: false, error: 'Admin client unavailable' };

  const now = new Date().toISOString();
  const { data, error } = await adminClient
    .from('telegram_uploads')
    .update({
      status: 'pending',
      rejection_reason: null,
      updated_at: now,
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    return { success: false, error: error?.message || 'Failed to reopen upload' };
  }

  await logAdminActivity(adminUsername, 'upload_reopened', 'upload', id);

  return { success: true, upload: data as TelegramUpload };
}

/**
 * Unpublishes a published document, immediately hiding it from the public library.
 */
export async function unpublishDocument(
  documentId: string,
  adminUsername: string
): Promise<{ success: boolean; error?: string }> {
  const adminClient = getAdminClient();
  if (!adminClient) return { success: false, error: 'Admin client unavailable' };

  const { error: docErr } = await adminClient
    .from('documents')
    .update({
      is_public: false,
      status: 'draft',
      updated_at: new Date().toISOString(),
    })
    .eq('id', documentId);

  if (docErr) return { success: false, error: docErr.message };

  await adminClient
    .from('telegram_uploads')
    .update({
      status: 'unpublished',
      updated_at: new Date().toISOString(),
    })
    .eq('document_id', documentId);

  await logAdminActivity(adminUsername, 'pdf_unpublished', 'document', documentId);

  return { success: true };
}
