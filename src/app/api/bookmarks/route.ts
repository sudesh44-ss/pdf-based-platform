import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/services/authService';
import { getBookmarks, createBookmark } from '@/lib/services/bookmarksService';
import { bookmarkSchema } from '@/lib/validation/schemas';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function GET(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return apiError('CONFIGURATION_ERROR', 'Supabase credentials are not configured', 503);
  }

  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return apiError('UNAUTHORIZED', 'Authentication required to view bookmarks', 401);
  }

  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get('document_id') || undefined;

  try {
    const bookmarks = await getBookmarks(supabase, user.id, documentId);
    return apiSuccess({ bookmarks, total: bookmarks.length });
  } catch (err: any) {
    return apiError('INTERNAL_ERROR', err.message || 'Failed to retrieve bookmarks', 500);
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return apiError('CONFIGURATION_ERROR', 'Supabase credentials are not configured', 503);
  }

  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return apiError('UNAUTHORIZED', 'Authentication required to create bookmarks', 401);
  }

  try {
    const body = await request.json();
    const parsed = bookmarkSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', parsed.error.issues[0].message, 422, parsed.error.issues);
    }

    const bookmark = await createBookmark(supabase, parsed.data, user.id);
    return apiSuccess(bookmark, 'Bookmark saved successfully', 201);
  } catch (err: any) {
    return apiError('BAD_REQUEST', err.message || 'Invalid bookmark request', 400);
  }
}
