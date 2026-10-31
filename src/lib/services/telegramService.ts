import { getAdminClient } from '@/lib/supabase/admin';
import { TelegramUpload, TelegramUploadStatus, Document } from '@/lib/types/database';
import { telegramClient } from '@/lib/telegram/client';
import { logAdminActivity } from '@/lib/auth/adminAuth';
import crypto from 'crypto';

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
  sender?: {
    id?: number;
    is_bot?: boolean;
    first_name?: string;
    last_name?: string;
    username?: string;
  };
}

/**
 * Validates that a buffer has the %PDF- magic bytes header.
 */
export function isPdfBuffer(buffer: Buffer | Uint8Array): boolean {
  if (!buffer || buffer.length < 5) return false;
  return (
    buffer[0] === 0x25 && // %
    buffer[1] === 0x50 && // P
    buffer[2] === 0x44 && // D
    buffer[3] === 0x46 && // F
    buffer[4] === 0x2d    // -
  );
}

/**
 * Validates whether a Telegram chat/channel ID is on the configured allowlist.
 */
export function isChatIdAllowed(chatId: number | string): boolean {
  const allowedList = [
    ...(process.env.TELEGRAM_ALLOWED_CHAT_IDS || '').split(','),
    process.env.TELEGRAM_CHANNEL_OR_CHAT_ID || '',
  ]
    .map((s) => s.trim())
    .filter(Boolean);

  // If no allowlist is configured in development, allow all
  if (allowedList.length === 0) return true;

  const chatStr = String(chatId);
  return allowedList.some((id) => id === chatStr);
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

  // 1. Idempotency check: Exact webhook retry by (chat_id, message_id)
  const { data: exactRetry } = await adminClient
    .from('telegram_uploads')
    .select('*')
    .eq('telegram_chat_id', doc.chatId)
    .eq('telegram_message_id', doc.messageId)
    .maybeSingle();

  if (exactRetry) {
    return { success: true, upload: exactRetry as TelegramUpload, isDuplicate: true };
  }

  // 2. Duplicate file content detection by telegram_file_unique_id
  let isDuplicate = false;
  let duplicateOfId: string | null = null;

  const { data: duplicateFile } = await adminClient
    .from('telegram_uploads')
    .select('id, title')
    .eq('telegram_file_unique_id', doc.fileUniqueId)
    .maybeSingle();

  if (duplicateFile) {
    isDuplicate = true;
    duplicateOfId = duplicateFile.id;
  }

  // 3. Validate file size against Telegram 20MB Cloud API limit
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
    source_type: 'telegram',
    is_duplicate: isDuplicate,
    duplicate_of_id: duplicateOfId,
    status,
    rejection_reason: failureReason,
    metadata: {
      source_chat_title: doc.chatTitle || null,
      received_at: new Date().toISOString(),
      sender: doc.sender || null,
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
    is_duplicate: isDuplicate,
    status,
  });

  return { success: true, upload: created as TelegramUpload, isDuplicate };
}

/**
 * Handles Direct PDF Upload from Admin Panel:
 * 1. Validates PDF magic bytes (%PDF-)
 * 2. Uploads binary directly to Telegram Group/Channel
 * 3. Ingests record into telegram_uploads as source_type = 'admin_upload'
 */
export async function createAdminDirectUpload(
  params: {
    fileBuffer: Buffer;
    fileName: string;
    title: string;
    description?: string;
    categoryId?: string;
    categoryName?: string;
    tags?: string[];
    author?: string;
    language?: string;
    publicationYear?: number;
  },
  adminUsername: string
): Promise<{ success: boolean; upload?: TelegramUpload; error?: string; isDuplicate?: boolean }> {
  const adminClient = getAdminClient();
  if (!adminClient) {
    return { success: false, error: 'Database service client unavailable' };
  }

  // 1. Validate %PDF- magic bytes
  if (!isPdfBuffer(params.fileBuffer)) {
    return {
      success: false,
      error: 'Invalid file format: file must be a valid PDF document with %PDF- header',
    };
  }

  // 2. Validate file size (Telegram Cloud Bot API limit 20MB for downloadability)
  const MAX_TELEGRAM_CLOUD_BYTES = 20 * 1024 * 1024;
  if (params.fileBuffer.length > MAX_TELEGRAM_CLOUD_BYTES) {
    return {
      success: false,
      error: `File size exceeds the Telegram Cloud Bot API 20MB limit (${(params.fileBuffer.length / (1024 * 1024)).toFixed(2)} MB).`,
    };
  }

  const fileHash = crypto.createHash('sha256').update(params.fileBuffer).digest('hex');

  // 3. Upload to Telegram group/channel
  const caption = [
    `Title: ${params.title}`,
    params.categoryName ? `Category: ${params.categoryName}` : null,
    `Uploaded via: Admin Panel (${adminUsername})`,
  ]
    .filter(Boolean)
    .join('\n');

  const uploadResult = await telegramClient.uploadPdf(params.fileBuffer, params.fileName, caption);

  if (!uploadResult.success || !uploadResult.fileId || !uploadResult.fileUniqueId) {
    return {
      success: false,
      error: uploadResult.error || 'Failed to upload PDF to Telegram central storage',
    };
  }

  // 4. Duplicate content check by telegram_file_unique_id
  let isDuplicate = false;
  let duplicateOfId: string | null = null;

  const { data: duplicateFile } = await adminClient
    .from('telegram_uploads')
    .select('id')
    .eq('telegram_file_unique_id', uploadResult.fileUniqueId)
    .maybeSingle();

  if (duplicateFile) {
    isDuplicate = true;
    duplicateOfId = duplicateFile.id;
  }

  // 5. Insert into telegram_uploads
  const newUploadPayload = {
    telegram_file_id: uploadResult.fileId,
    telegram_file_unique_id: uploadResult.fileUniqueId,
    telegram_chat_id: Number(process.env.TELEGRAM_CHANNEL_OR_CHAT_ID || process.env.TELEGRAM_ALLOWED_CHAT_IDS?.split(',')[0] || 0),
    telegram_message_id: uploadResult.messageId || 0,
    original_filename: params.fileName,
    mime_type: 'application/pdf',
    file_size: params.fileBuffer.length,
    file_hash: fileHash,
    title: params.title.trim(),
    description: params.description?.trim() || '',
    category_id: params.categoryId || null,
    category_name: params.categoryName || null,
    tags: params.tags || [],
    author: params.author?.trim() || null,
    language: params.language || 'en',
    publication_year: params.publicationYear || null,
    source_type: 'admin_upload',
    is_duplicate: isDuplicate,
    duplicate_of_id: duplicateOfId,
    status: 'pending',
    reviewed_by: adminUsername,
    metadata: {
      uploaded_by_admin: adminUsername,
      direct_upload: true,
      uploaded_at: new Date().toISOString(),
    },
  };

  const { data: created, error } = await adminClient
    .from('telegram_uploads')
    .insert(newUploadPayload)
    .select('*')
    .single();

  if (error || !created) {
    console.error('Error inserting admin direct upload:', error);
    return { success: false, error: error?.message || 'Database insert failed' };
  }

  await logAdminActivity(adminUsername, 'admin_direct_upload', 'upload', created.id, {
    file_name: params.fileName,
    file_size: params.fileBuffer.length,
    telegram_message_id: uploadResult.messageId,
  });

  return { success: true, upload: created as TelegramUpload, isDuplicate };
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
        storage_type: 'telegram',
        storage_file_id: upload.telegram_file_id,
        telegram_chat_id: upload.telegram_chat_id,
        telegram_message_id: upload.telegram_message_id,
        telegram_file_unique_id: upload.telegram_file_unique_id,
        source_type: upload.source_type || 'telegram',
        is_public: true,
        status: 'published',
        is_trash: false,
        is_deleted: false,
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
        telegram_chat_id: upload.telegram_chat_id,
        telegram_message_id: upload.telegram_message_id,
        telegram_file_unique_id: upload.telegram_file_unique_id,
        source_type: upload.source_type || 'telegram',
        is_public: true,
        status: 'published',
        is_trash: false,
        is_deleted: false,
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

/**
 * Permanently deletes a document:
 * 1. Attempts to delete Telegram message binary via Telegram Bot API deleteMessage.
 * 2. Unpublishes and marks document soft-deleted in Supabase (is_deleted: true, is_trash: true, telegram_deleted: boolean).
 * 3. Logs activity for auditing.
 */
export async function deleteDocumentEverywhere(
  documentId: string,
  adminUsername: string
): Promise<{ success: boolean; telegramDeleted: boolean; error?: string }> {
  const adminClient = getAdminClient();
  if (!adminClient) {
    return { success: false, telegramDeleted: false, error: 'Admin client unavailable' };
  }

  // 1. Fetch document and associated Telegram info
  const { data: doc, error: docErr } = await adminClient
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .maybeSingle();

  if (docErr || !doc) {
    return { success: false, telegramDeleted: false, error: 'Document not found' };
  }

  let chatId = doc.telegram_chat_id;
  let messageId = doc.telegram_message_id;

  // Fallback to linked upload if document columns were null
  if (!chatId || !messageId) {
    const { data: linkedUpload } = await adminClient
      .from('telegram_uploads')
      .select('telegram_chat_id, telegram_message_id')
      .eq('document_id', documentId)
      .maybeSingle();

    if (linkedUpload) {
      chatId = linkedUpload.telegram_chat_id;
      messageId = linkedUpload.telegram_message_id;
    }
  }

  let telegramDeleted = false;
  let telegramError: string | undefined;

  // 2. Attempt Telegram message deletion if references exist
  if (chatId && messageId) {
    const tgResult = await telegramClient.deleteMessage(chatId, messageId);
    telegramDeleted = tgResult.success;
    if (!tgResult.success) {
      telegramError = tgResult.error;
      console.warn(`Could not delete Telegram message (${chatId}:${messageId}): ${tgResult.error}`);
    }
  }

  // 3. Update document in Supabase
  const now = new Date().toISOString();
  await adminClient
    .from('documents')
    .update({
      is_public: false,
      status: 'archived',
      is_trash: true,
      trashed_at: now,
      is_deleted: true,
      deleted_at: now,
      telegram_deleted: telegramDeleted,
      updated_at: now,
    })
    .eq('id', documentId);

  // 4. Update linked telegram_upload status
  await adminClient
    .from('telegram_uploads')
    .update({
      status: 'unpublished',
      updated_at: now,
    })
    .eq('document_id', documentId);

  // 5. Log activity
  await logAdminActivity(adminUsername, 'document_deleted_everywhere', 'document', documentId, {
    title: doc.title,
    telegram_deleted: telegramDeleted,
    telegram_error: telegramError || null,
  });

  return {
    success: true,
    telegramDeleted,
    error: telegramError,
  };
}
