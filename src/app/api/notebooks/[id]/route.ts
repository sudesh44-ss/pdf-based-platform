import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/services/authService';
import { getNotebookById, updateNotebook, deleteNotebook } from '@/lib/services/notebooksService';
import { notebookSchema } from '@/lib/validation/schemas';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  if (!supabase) {
    return apiError('CONFIGURATION_ERROR', 'Supabase credentials are not configured', 503);
  }

  const { id } = await params;
  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return apiError('UNAUTHORIZED', 'Authentication required', 401);
  }

  const notebook = await getNotebookById(supabase, id, user.id);
  if (!notebook) {
    return apiError('NOT_FOUND', 'Notebook not found or unauthorized', 404);
  }

  return apiSuccess(notebook);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  if (!supabase) {
    return apiError('CONFIGURATION_ERROR', 'Supabase credentials are not configured', 503);
  }

  const { id } = await params;
  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return apiError('UNAUTHORIZED', 'Authentication required', 401);
  }

  try {
    const body = await request.json();
    const parsed = notebookSchema.partial().safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', parsed.error.issues[0].message, 422, parsed.error.issues);
    }

    const updated = await updateNotebook(supabase, id, parsed.data, user.id);
    if (!updated) {
      return apiError('NOT_FOUND', 'Notebook not found or unauthorized', 404);
    }

    return apiSuccess(updated, 'Notebook updated successfully');
  } catch (err: any) {
    return apiError('INTERNAL_ERROR', err.message || 'Failed to update notebook', 500);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  if (!supabase) {
    return apiError('CONFIGURATION_ERROR', 'Supabase credentials are not configured', 503);
  }

  const { id } = await params;
  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return apiError('UNAUTHORIZED', 'Authentication required', 401);
  }

  try {
    await deleteNotebook(supabase, id, user.id);
    return apiSuccess({ deleted: true }, 'Notebook deleted successfully');
  } catch (err: any) {
    return apiError('INTERNAL_ERROR', err.message || 'Failed to delete notebook', 500);
  }
}
