import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/services/authService';
import { getNotes, createNote } from '@/lib/services/notesService';
import { noteSchema } from '@/lib/validation/schemas';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function GET(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return apiError('CONFIGURATION_ERROR', 'Supabase credentials are not configured', 503);
  }

  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return apiError('UNAUTHORIZED', 'Authentication required to view notes', 401);
  }

  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get('document_id') || undefined;
  const notebookId = searchParams.get('notebook_id') || undefined;
  const search = searchParams.get('q') || undefined;
  const isFavorite = searchParams.has('is_favorite')
    ? searchParams.get('is_favorite') === 'true'
    : undefined;

  try {
    const notes = await getNotes(supabase, user.id, {
      documentId,
      notebookId,
      search,
      isFavorite,
    });
    return apiSuccess({ notes, total: notes.length });
  } catch (err: any) {
    return apiError('INTERNAL_ERROR', err.message || 'Failed to retrieve notes', 500);
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return apiError('CONFIGURATION_ERROR', 'Supabase credentials are not configured', 503);
  }

  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return apiError('UNAUTHORIZED', 'Authentication required to create notes', 401);
  }

  try {
    const body = await request.json();
    const parsed = noteSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', parsed.error.issues[0].message, 422, parsed.error.issues);
    }

    const note = await createNote(supabase, parsed.data, user.id);
    return apiSuccess(note, 'Note created successfully', 201);
  } catch (err: any) {
    return apiError('BAD_REQUEST', err.message || 'Invalid note request', 400);
  }
}
