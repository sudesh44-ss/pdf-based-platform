import { getVerifiedAdminSession } from '@/lib/auth/adminAuth';
import { rejectUpload } from '@/lib/services/telegramService';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getVerifiedAdminSession();
  if (!session.valid || !session.username) {
    return apiError('UNAUTHORIZED', 'Administrator session required', 401);
  }

  const { id } = await params;
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // optional body
  }

  const reason = body?.reason || 'Did not meet publication guidelines or quality requirements.';

  try {
    const result = await rejectUpload(id, reason, session.username);
    if (!result.success) {
      return apiError('REJECTION_FAILED', result.error || 'Failed to reject upload', 400);
    }

    return apiSuccess(result.upload, 'Upload rejected successfully');
  } catch (err: any) {
    console.error('Error rejecting upload:', err);
    return apiError('INTERNAL_ERROR', err.message || 'Internal error rejecting upload', 500);
  }
}
