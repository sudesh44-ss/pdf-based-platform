import { getVerifiedAdminSession } from '@/lib/auth/adminAuth';
import { getAdminClient } from '@/lib/supabase/admin';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function GET(request: Request) {
  const session = await getVerifiedAdminSession();
  if (!session.valid) {
    return apiError('UNAUTHORIZED', 'Administrator session required', 401);
  }

  const adminClient = getAdminClient();
  if (!adminClient) {
    return apiError('CONFIGURATION_ERROR', 'Admin database client unavailable', 503);
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '30', 10);
  const offset = (page - 1) * limit;

  const { data, count, error } = await adminClient
    .from('admin_activity_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return apiError('INTERNAL_ERROR', error.message, 500);
  }

  return apiSuccess({
    logs: data || [],
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit) || 1,
  });
}
