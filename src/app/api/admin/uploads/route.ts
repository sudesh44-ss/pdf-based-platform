import { getVerifiedAdminSession } from '@/lib/auth/adminAuth';
import { getTelegramUploads } from '@/lib/services/telegramService';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function GET(request: Request) {
  const session = await getVerifiedAdminSession();
  if (!session.valid) {
    return apiError('UNAUTHORIZED', 'Administrator session required', 401);
  }

  const { searchParams } = new URL(request.url);
  const status = (searchParams.get('status') || 'all') as any;
  const search = searchParams.get('q') || undefined;
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  try {
    const result = await getTelegramUploads({
      status,
      search,
      page,
      limit,
    });
    return apiSuccess(result);
  } catch (err: any) {
    console.error('Error fetching admin uploads:', err);
    return apiError('INTERNAL_ERROR', err.message || 'Failed to retrieve uploads', 500);
  }
}
