import { getVerifiedAdminSession } from '@/lib/auth/adminAuth';
import { reopenUpload } from '@/lib/services/telegramService';
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
    const result = await reopenUpload(id, session.username);
    if (!result.success) {
      return apiError('REOPEN_FAILED', result.error || 'Failed to reopen upload', 400);
    }

    return apiSuccess(result.upload, 'Upload reopened for review');
  } catch (err: any) {
    console.error('Error reopening upload:', err);
    return apiError('INTERNAL_ERROR', err.message || 'Internal error reopening upload', 500);
  }
}
