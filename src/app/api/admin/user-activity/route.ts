import { getVerifiedAdminSession } from '@/lib/auth/adminAuth';
import { getAdminClient } from '@/lib/supabase/admin';
import { apiSuccess, apiError } from '@/lib/api/response';

/**
 * OpenShelf Admin User Reading Activity Overview API
 *
 * Privacy Guarantees:
 * - Admin has visibility into aggregated and document-level reading progress/metrics.
 * - Under NO CIRCUMSTANCES is personal user notes content exposed to Admin.
 * - This endpoint queries ONLY reading_progress and reading_history joined with document metadata.
 */

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
  const limit = parseInt(searchParams.get('limit') || '25', 10);
  const offset = (page - 1) * limit;
  const documentId = searchParams.get('document_id');
  const userId = searchParams.get('user_id');

  try {
    let query = adminClient
      .from('reading_progress')
      .select(
        `
        id,
        user_id,
        document_id,
        current_page,
        total_pages,
        percentage,
        active_seconds,
        last_read_at,
        created_at,
        documents:document_id (id, title, page_count, file_size),
        profiles:user_id (id, email, full_name)
      `,
        { count: 'exact' }
      )
      .order('last_read_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (documentId) {
      query = query.eq('document_id', documentId);
    }
    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error('Admin user activity fetch error:', error);
      return apiError('INTERNAL_ERROR', error.message, 500);
    }

    const formatted = (data || []).map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      user_email: row.profiles?.email || 'Anonymous/Local User',
      user_name: row.profiles?.full_name || null,
      document_id: row.document_id,
      document_title: row.documents?.title || 'Unknown Document',
      current_page: row.current_page,
      total_pages: row.total_pages,
      percentage: Number(row.percentage) || 0,
      active_seconds: row.active_seconds || 0,
      last_read_at: row.last_read_at,
    }));

    return apiSuccess({
      activity: formatted,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit) || 1,
      privacyGuarantee: 'Personal notes content is client-side encrypted / local-first and strictly excluded.',
    });
  } catch (err: any) {
    console.error('Unexpected admin user activity error:', err);
    return apiError('INTERNAL_ERROR', err.message || 'Failed to fetch user activity', 500);
  }
}
