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
  const status = searchParams.get('status');
  const search = searchParams.get('q');
  const category = searchParams.get('category');
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const offset = (page - 1) * limit;

  let query = adminClient
    .from('documents')
    .select('*', { count: 'exact' })
    .eq('is_trash', false);

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  if (category && category !== 'all') {
    query = query.contains('categories', [category]);
  }

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(`title.ilike.${term},description.ilike.${term}`);
  }

  query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) {
    console.error('Error in admin documents GET:', error);
    return apiError('INTERNAL_ERROR', error.message, 500);
  }

  return apiSuccess({
    documents: data || [],
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit) || 1,
  });
}
