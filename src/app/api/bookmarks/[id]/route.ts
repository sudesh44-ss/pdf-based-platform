import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/services/authService';
import { deleteBookmark } from '@/lib/services/bookmarksService';
import { apiSuccess, apiError } from '@/lib/api/response';

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
    await deleteBookmark(supabase, id, user.id);
    return apiSuccess({ deleted: true }, 'Bookmark removed successfully');
  } catch (err: any) {
    return apiError('INTERNAL_ERROR', err.message || 'Failed to delete bookmark', 500);
  }
}
