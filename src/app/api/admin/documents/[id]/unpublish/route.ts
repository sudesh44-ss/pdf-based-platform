import { getVerifiedAdminSession } from '@/lib/auth/adminAuth';
import { unpublishDocument } from '@/lib/services/telegramService';
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
    const result = await unpublishDocument(id, session.username);
    if (!result.success) {
      return apiError('UNPUBLISH_FAILED', result.error || 'Failed to unpublish document', 400);
    }

    return apiSuccess({ unpublished: true }, 'Document successfully unpublished and hidden from library');
  } catch (err: any) {
    console.error('Error unpublishing document:', err);
    return apiError('INTERNAL_ERROR', err.message || 'Internal error', 500);
  }
}
