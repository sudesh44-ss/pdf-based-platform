import { SupabaseClient } from '@supabase/supabase-js';
import { ContributionSubmission, ContentReport } from '../types/database';

export async function getSubmissions(
  supabase: SupabaseClient,
  userId?: string,
  isAdmin: boolean = false
): Promise<ContributionSubmission[]> {
  let query = supabase
    .from('contribution_submissions')
    .select('*')
    .order('created_at', { ascending: false });

  if (!isAdmin && userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching submissions:', error);
    throw new Error(error.message);
  }

  return (data || []) as ContributionSubmission[];
}

export async function createSubmission(
  supabase: SupabaseClient,
  data: {
    title: string;
    description?: string;
    file_name: string;
    file_size: number;
    categories?: string[];
    tags?: string[];
    rights_declared: boolean;
  },
  userId: string
): Promise<ContributionSubmission> {
  const payload = {
    user_id: userId,
    title: data.title.trim(),
    description: data.description?.trim() || '',
    file_name: data.file_name,
    file_size: data.file_size,
    categories: data.categories || [],
    tags: data.tags || [],
    rights_declared: Boolean(data.rights_declared),
    status: 'pending_review',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: created, error } = await supabase
    .from('contribution_submissions')
    .insert(payload)
    .select('*')
    .single();

  if (error || !created) {
    throw new Error(error?.message || 'Failed to submit contribution');
  }

  return created as ContributionSubmission;
}

export async function reviewSubmission(
  supabase: SupabaseClient,
  submissionId: string,
  adminId: string,
  action: 'approve' | 'reject',
  rejectionReason?: string
): Promise<ContributionSubmission> {
  const newStatus = action === 'approve' ? 'published' : 'rejected';

  // 1. Fetch current submission
  const { data: submission, error: fetchErr } = await supabase
    .from('contribution_submissions')
    .select('*')
    .eq('id', submissionId)
    .single();

  if (fetchErr || !submission) {
    throw new Error('SUBMISSION_NOT_FOUND');
  }

  // 2. Update submission record
  const { data: updated, error: updateErr } = await supabase
    .from('contribution_submissions')
    .update({
      status: newStatus,
      rejection_reason: action === 'reject' ? (rejectionReason || 'Content did not meet review guidelines') : null,
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', submissionId)
    .select('*')
    .single();

  if (updateErr || !updated) {
    throw new Error(updateErr?.message || 'Failed to update submission');
  }

  // 3. If approved and document exists or needs to be published in documents table
  let publishedDocId = submission.document_id;
  if (action === 'approve') {
    if (!publishedDocId) {
      // Create public document entry
      const { data: newDoc } = await supabase
        .from('documents')
        .insert({
          user_id: submission.user_id,
          title: submission.title,
          description: submission.description,
          file_name: submission.file_name,
          file_size: submission.file_size,
          mime_type: 'application/pdf',
          page_count: 1,
          storage_type: 'telegram',
          storage_file_path: '/samples/sample-study-guide.pdf',
          is_public: true,
          status: 'published',
          categories: submission.categories,
          tags: submission.tags,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (newDoc) {
        publishedDocId = newDoc.id;
        await supabase
          .from('contribution_submissions')
          .update({ document_id: publishedDocId })
          .eq('id', submissionId);
      }
    } else {
      // Publish the linked document
      await supabase
        .from('documents')
        .update({ is_public: true, status: 'published' })
        .eq('id', publishedDocId);
    }
  }

  // 4. Log moderation event
  await supabase.from('moderation_events').insert({
    moderator_id: adminId,
    submission_id: submissionId,
    document_id: publishedDocId || null,
    action: action,
    reason: rejectionReason || `Submission ${action}d by moderator`,
    created_at: new Date().toISOString(),
  });

  return updated as ContributionSubmission;
}

export async function getContentReports(
  supabase: SupabaseClient
): Promise<ContentReport[]> {
  const { data, error } = await supabase
    .from('content_reports')
    .select(`
      *,
      documents:document_id (title)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching reports:', error);
    throw new Error(error.message);
  }

  return (data || []).map((row: any) => ({
    ...row,
    document_title: row.documents?.title || undefined,
  })) as ContentReport[];
}

export async function createContentReport(
  supabase: SupabaseClient,
  data: { document_id: string; reason: string; details?: string },
  reporterId?: string
): Promise<ContentReport> {
  const payload = {
    reporter_id: reporterId || null,
    document_id: data.document_id,
    reason: data.reason,
    details: data.details || null,
    status: 'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: created, error } = await supabase
    .from('content_reports')
    .insert(payload)
    .select('*')
    .single();

  if (error || !created) {
    throw new Error(error?.message || 'Failed to file content report');
  }

  return created as ContentReport;
}

export async function resolveContentReport(
  supabase: SupabaseClient,
  reportId: string,
  adminId: string,
  resolutionNotes: string
): Promise<ContentReport> {
  const { data, error } = await supabase
    .from('content_reports')
    .update({
      status: 'resolved',
      resolution_notes: resolutionNotes,
      resolved_by: adminId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reportId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to resolve content report');
  }

  return data as ContentReport;
}
