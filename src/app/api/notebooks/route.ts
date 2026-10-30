import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/services/authService';
import { getNotebooks, createNotebook } from '@/lib/services/notebooksService';
import { notebookSchema } from '@/lib/validation/schemas';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function GET() {
  const supabase = await createClient();
  if (!supabase) {
    return apiError('CONFIGURATION_ERROR', 'Supabase credentials are not configured', 503);
  }

  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return apiError('UNAUTHORIZED', 'Authentication required to view notebooks', 401);
  }

  try {
    const notebooks = await getNotebooks(supabase, user.id);
    return apiSuccess({ notebooks, total: notebooks.length });
  } catch (err: any) {
    return apiError('INTERNAL_ERROR', err.message || 'Failed to retrieve notebooks', 500);
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return apiError('CONFIGURATION_ERROR', 'Supabase credentials are not configured', 503);
  }

  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return apiError('UNAUTHORIZED', 'Authentication required to create notebooks', 401);
  }

  try {
    const body = await request.json();
    const parsed = notebookSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', parsed.error.issues[0].message, 422, parsed.error.issues);
    }

    const notebook = await createNotebook(supabase, parsed.data, user.id);
    return apiSuccess(notebook, 'Notebook created successfully', 201);
  } catch (err: any) {
    return apiError('BAD_REQUEST', err.message || 'Invalid notebook request', 400);
  }
}
