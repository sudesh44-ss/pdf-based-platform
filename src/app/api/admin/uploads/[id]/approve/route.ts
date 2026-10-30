import { getVerifiedAdminSession } from '@/lib/auth/adminAuth';
import { approveAndPublishUpload } from '@/lib/services/telegramService';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getVerifiedAdminSession();
  if (!session.valid || !session.username) {
    return apiError('UNAUTHORIZED', 'Administrator session required', 401);
  }

  const { id } = await params;
  try {
    const result = await approveAndPublishUpload(id, session.username);
    if (!result.success) {
      return apiError('APPROVAL_FAILED', result.error || 'Failed to approve upload', 400);
    }

    return apiSuccess({
      upload: result.upload,
      document: result.document,
    }, 'PDF successfully approved and published to Public Library');
  } catch (err: any) {
    console.error('Error approving upload:', err);
    return apiError('INTERNAL_ERROR', err.message || 'Internal error approving upload', 500);
  }
}
