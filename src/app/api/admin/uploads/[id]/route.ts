import { getVerifiedAdminSession } from '@/lib/auth/adminAuth';
import { getUploadById, updateUploadMetadata } from '@/lib/services/telegramService';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getVerifiedAdminSession();
  if (!session.valid) {
    return apiError('UNAUTHORIZED', 'Administrator session required', 401);
  }

  const { id } = await params;
  const upload = await getUploadById(id);
  if (!upload) {
    return apiError('NOT_FOUND', 'Upload not found', 404);
  }

  return apiSuccess(upload);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getVerifiedAdminSession();
  if (!session.valid || !session.username) {
    return apiError('UNAUTHORIZED', 'Administrator session required', 401);
  }

  const { id } = await params;
  let body: any;
  try {
    body = await request.json();
  } catch {
    return apiError('INVALID_REQUEST', 'Invalid JSON body', 400);
  }

  try {
    const updated = await updateUploadMetadata(id, body, session.username);
    if (!updated) {
      return apiError('NOT_FOUND', 'Upload record not found', 404);
    }
    return apiSuccess(updated, 'Metadata updated successfully');
  } catch (err: any) {
    return apiError('INTERNAL_ERROR', err.message || 'Failed to update metadata', 500);
  }
}
