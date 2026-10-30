import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/services/authService';
import { getReadingProgress, upsertReadingProgress } from '@/lib/services/readingProgressService';
import { readingProgressSchema } from '@/lib/validation/schemas';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function GET(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return apiError('CONFIGURATION_ERROR', 'Supabase credentials are not configured', 503);
  }

  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return apiError('UNAUTHORIZED', 'Authentication required to view reading progress', 401);
  }

  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get('document_id') || undefined;

  try {
    const list = await getReadingProgress(supabase, user.id, documentId);
    return apiSuccess({ progressList: list, total: list.length });
  } catch (err: any) {
    return apiError('INTERNAL_ERROR', err.message || 'Failed to retrieve reading progress', 500);
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return apiError('CONFIGURATION_ERROR', 'Supabase credentials are not configured', 503);
  }

  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return apiError('UNAUTHORIZED', 'Authentication required to save reading progress', 401);
  }

  try {
    const body = await request.json();
    const parsed = readingProgressSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', parsed.error.issues[0].message, 422, parsed.error.issues);
    }

    const progress = await upsertReadingProgress(supabase, parsed.data, user.id);
    return apiSuccess(progress, 'Reading progress recorded', 200);
  } catch (err: any) {
    return apiError('BAD_REQUEST', err.message || 'Invalid reading progress payload', 400);
  }
}

export async function PATCH(request: Request) {
  return POST(request);
}
