import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/services/authService';
import { getNoteById, updateNote, deleteNote } from '@/lib/services/notesService';
import { noteSchema } from '@/lib/validation/schemas';
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

  const note = await getNoteById(supabase, id, user.id);
  if (!note) {
    return apiError('NOT_FOUND', 'Note not found or unauthorized', 404);
  }

  return apiSuccess(note);
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
    const parsed = noteSchema.partial().safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', parsed.error.issues[0].message, 422, parsed.error.issues);
    }

    const updated = await updateNote(supabase, id, parsed.data, user.id);
    if (!updated) {
      return apiError('NOT_FOUND', 'Note not found or unauthorized', 404);
    }

    return apiSuccess(updated, 'Note updated successfully');
  } catch (err: any) {
    return apiError('INTERNAL_ERROR', err.message || 'Failed to update note', 500);
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
    await deleteNote(supabase, id, user.id);
    return apiSuccess({ deleted: true }, 'Note deleted successfully');
  } catch (err: any) {
    return apiError('INTERNAL_ERROR', err.message || 'Failed to delete note', 500);
  }
}
