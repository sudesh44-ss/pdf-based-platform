import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser, isUserAdmin } from '@/lib/services/authService';
import { getDocumentById, updateDocument, deleteDocument } from '@/lib/services/documentService';
import { apiSuccess, apiError } from '@/lib/api/response';
import { z } from 'zod';

const updateDocumentSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  description: z.string().max(2000).optional(),
  categories: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  is_public: z.boolean().optional(),
  is_trash: z.boolean().optional(),
}).strict(); // Defend against mass assignment

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  if (!supabase) {
    return apiError('CONFIGURATION_ERROR', 'Supabase credentials are not configured', 503);
  }

  const { id } = await params;
  const user = await getAuthenticatedUser(supabase);
  const isAdmin = user ? await isUserAdmin(supabase, user) : false;

  const doc = await getDocumentById(supabase, id, user?.id, isAdmin);
  if (!doc) {
    return apiError('NOT_FOUND', 'Document not found or access denied', 404);
  }

  return apiSuccess(doc);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  if (!supabase) {
    return apiError('CONFIGURATION_ERROR', 'Supabase credentials are not configured', 503);
  }

  const { id } = await params;
  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return apiError('UNAUTHORIZED', 'Authentication required', 401);
  }

  const isAdmin = await isUserAdmin(supabase, user);

  try {
    const body = await request.json();
    const parsed = updateDocumentSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', parsed.error.issues[0].message, 422, parsed.error.issues);
    }

    const updated = await updateDocument(supabase, id, parsed.data, user.id, isAdmin);
    if (!updated) {
      return apiError('NOT_FOUND', 'Document not found', 404);
    }

    return apiSuccess(updated, 'Document updated successfully');
  } catch (err: any) {
    if (err.message === 'FORBIDDEN') {
      return apiError('FORBIDDEN', 'You do not have permission to modify this document', 403);
    }
    return apiError('INTERNAL_ERROR', err.message || 'Failed to update document', 500);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  if (!supabase) {
    return apiError('CONFIGURATION_ERROR', 'Supabase credentials are not configured', 503);
  }

  const { id } = await params;
  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return apiError('UNAUTHORIZED', 'Authentication required', 401);
  }

  const { searchParams } = new URL(request.url);
  const permanent = searchParams.get('permanent') === 'true';

  const isAdmin = await isUserAdmin(supabase, user);

  try {
    const success = await deleteDocument(supabase, id, user.id, isAdmin, permanent);
    if (!success) {
      return apiError('NOT_FOUND', 'Document not found or unauthorized', 404);
    }

    return apiSuccess({ deleted: true }, permanent ? 'Document permanently deleted' : 'Document moved to trash');
  } catch (err: any) {
    if (err.message === 'FORBIDDEN') {
      return apiError('FORBIDDEN', 'You do not have permission to delete this document', 403);
    }
    return apiError('INTERNAL_ERROR', err.message || 'Failed to delete document', 500);
  }
}
