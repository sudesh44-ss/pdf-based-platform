import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser, isUserAdmin } from '@/lib/services/authService';
import {
  getSubmissions,
  reviewSubmission,
  getContentReports,
  resolveContentReport,
} from '@/lib/services/moderationService';
import { submissionReviewSchema } from '@/lib/validation/schemas';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function GET() {
  const supabase = await createClient();
  if (!supabase) {
    return apiError('CONFIGURATION_ERROR', 'Supabase credentials are not configured', 503);
  }

  // 1. Authenticate user
  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return apiError('UNAUTHORIZED', 'Authentication required', 401);
  }

  // 2. Strict server-side admin check
  const isAdmin = await isUserAdmin(supabase, user);
  if (!isAdmin) {
    return apiError('FORBIDDEN', 'Administrative privileges required', 403);
  }

  try {
    const [submissions, reports] = await Promise.all([
      getSubmissions(supabase, undefined, true),
      getContentReports(supabase),
    ]);

    return apiSuccess({
      submissions,
      reports,
      pendingCount: submissions.filter((s) => s.status === 'pending_review').length,
    });
  } catch (err: any) {
    console.error('Error in GET /api/moderation:', err);
    return apiError('INTERNAL_ERROR', err.message || 'Failed to retrieve moderation data', 500);
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return apiError('CONFIGURATION_ERROR', 'Supabase credentials are not configured', 503);
  }

  // 1. Authenticate user
  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return apiError('UNAUTHORIZED', 'Authentication required', 401);
  }

  // 2. Strict server-side admin check
  const isAdmin = await isUserAdmin(supabase, user);
  if (!isAdmin) {
    return apiError('FORBIDDEN', 'Administrative privileges required to moderate content', 403);
  }

  try {
    const body = await request.json();

    // Check if resolving a report vs reviewing a submission
    if (body.type === 'report_resolution') {
      const { report_id, resolution_notes } = body;
      if (!report_id || !resolution_notes) {
        return apiError('VALIDATION_ERROR', 'report_id and resolution_notes are required', 422);
      }
      const resolved = await resolveContentReport(supabase, report_id, user.id, resolution_notes);
      return apiSuccess(resolved, 'Content report resolved');
    }

    // Default: review submission
    const parsed = submissionReviewSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', parsed.error.issues[0].message, 422, parsed.error.issues);
    }

    if (parsed.data.action === 'reject' && !parsed.data.rejection_reason) {
      return apiError('VALIDATION_ERROR', 'A rejection reason is required when rejecting a submission', 422);
    }

    const reviewed = await reviewSubmission(
      supabase,
      parsed.data.submission_id,
      user.id,
      parsed.data.action,
      parsed.data.rejection_reason
    );

    return apiSuccess(reviewed, `Submission ${parsed.data.action}d successfully`);
  } catch (err: any) {
    if (err.message === 'SUBMISSION_NOT_FOUND') {
      return apiError('NOT_FOUND', 'Submission record not found', 404);
    }
    console.error('Error in POST /api/moderation:', err);
    return apiError('INTERNAL_ERROR', err.message || 'Moderation action failed', 500);
  }
}
