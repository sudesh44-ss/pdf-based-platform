import { getVerifiedAdminSession, logAdminActivity } from '@/lib/auth/adminAuth';
import { getAdminClient } from '@/lib/supabase/admin';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getVerifiedAdminSession();
  if (!session.valid || !session.username) {
    return apiError('UNAUTHORIZED', 'Administrator session required', 401);
  }

  const { id } = await params;
  const adminClient = getAdminClient();
  if (!adminClient) {
    return apiError('CONFIGURATION_ERROR', 'Admin database client unavailable', 503);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return apiError('INVALID_REQUEST', 'Invalid JSON body', 400);
  }

  const allowedUpdates: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (body.title) allowedUpdates.title = body.title.trim();
  if (body.description !== undefined) allowedUpdates.description = body.description?.trim() || '';
  if (body.categories) allowedUpdates.categories = body.categories;
  if (body.tags) allowedUpdates.tags = body.tags;
  if (body.is_public !== undefined) allowedUpdates.is_public = Boolean(body.is_public);
  if (body.status) allowedUpdates.status = body.status;

  const { data, error } = await adminClient
    .from('documents')
    .update(allowedUpdates)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    return apiError('UPDATE_FAILED', error?.message || 'Document not found', 404);
  }

  await logAdminActivity(session.username, 'metadata_updated', 'document', id, allowedUpdates);

  return apiSuccess(data, 'Document updated successfully');
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getVerifiedAdminSession();
  if (!session.valid || !session.username) {
    return apiError('UNAUTHORIZED', 'Administrator session required', 401);
  }

  const { id } = await params;
  const adminClient = getAdminClient();
  if (!adminClient) {
    return apiError('CONFIGURATION_ERROR', 'Admin database client unavailable', 503);
  }

  // Soft delete document
  const { data, error } = await adminClient
    .from('documents')
    .update({
      is_trash: true,
      trashed_at: new Date().toISOString(),
      is_public: false,
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    return apiError('DELETE_FAILED', error?.message || 'Document not found', 404);
  }

  await logAdminActivity(session.username, 'document_deleted', 'document', id);

  return apiSuccess({ deleted: true }, 'Document removed successfully');
}
