import { getVerifiedAdminSession } from '@/lib/auth/adminAuth';
import { getAdminClient } from '@/lib/supabase/admin';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function GET(_request: Request) {
  const session = await getVerifiedAdminSession();
  if (!session.valid) {
    return apiError('UNAUTHORIZED', 'Administrator session required', 401);
  }

  const adminClient = getAdminClient();
  if (!adminClient) {
    return apiError('CONFIGURATION_ERROR', 'Admin database client unavailable', 503);
  }

  try {
    const [
      totalDocsRes,
      publishedDocsRes,
      pendingUploadsRes,
      underReviewRes,
      approvedRes,
      rejectedRes,
      categoriesRes,
      recentLogsRes,
    ] = await Promise.all([
      adminClient.from('documents').select('id', { count: 'exact', head: true }).eq('is_trash', false),
      adminClient.from('documents').select('id', { count: 'exact', head: true }).eq('status', 'published').eq('is_trash', false),
      adminClient.from('telegram_uploads').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      adminClient.from('telegram_uploads').select('id', { count: 'exact', head: true }).eq('status', 'under_review'),
      adminClient.from('telegram_uploads').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
      adminClient.from('telegram_uploads').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
      adminClient.from('categories').select('id', { count: 'exact', head: true }),
      adminClient.from('admin_activity_logs').select('*').order('created_at', { ascending: false }).limit(8),
    ]);

    const metrics = {
      totalDocuments: totalDocsRes.count || 0,
      publishedDocuments: publishedDocsRes.count || 0,
      pendingUploads: pendingUploadsRes.count || 0,
      underReviewUploads: underReviewRes.count || 0,
      approvedUploads: approvedRes.count || 0,
      rejectedUploads: rejectedRes.count || 0,
      totalCategories: categoriesRes.count || 0,
      recentActivities: recentLogsRes.data || [],
    };

    return apiSuccess(metrics);
  } catch (err: any) {
    console.error('Error loading admin dashboard metrics:', err);
    return apiError('INTERNAL_ERROR', err.message || 'Failed to fetch dashboard metrics', 500);
  }
}
