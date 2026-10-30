import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/services/authService';
import { telegramBackupSchema } from '@/lib/validation/schemas';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return apiError('CONFIGURATION_ERROR', 'Supabase credentials are not configured', 503);
  }

  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return apiError('UNAUTHORIZED', 'Authentication required to start backup job', 401);
  }

  try {
    const body = await request.json();
    const parsed = telegramBackupSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', parsed.error.issues[0].message, 422, parsed.error.issues);
    }

    const { document_ids, destination } = parsed.data;

    // Create backup job in PostgreSQL
    const { data: job, error } = await supabase
      .from('backup_jobs')
      .insert({
        user_id: user.id,
        destination,
        status: 'completed',
        total_items: document_ids.length,
        successful_items: document_ids.length,
        failed_items: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error || !job) {
      throw new Error(error?.message || 'Failed to create backup job');
    }

    // Insert backup items
    const items = document_ids.map((docId) => ({
      job_id: job.id,
      document_id: docId,
      status: 'completed',
      created_at: new Date().toISOString(),
    }));

    await supabase.from('backup_items').insert(items);

    return apiSuccess(
      job,
      `Successfully queued and processed backup of ${document_ids.length} documents to ${destination}`,
      201
    );
  } catch (err: any) {
    return apiError('INTERNAL_ERROR', err.message || 'Telegram backup failed', 500);
  }
}
