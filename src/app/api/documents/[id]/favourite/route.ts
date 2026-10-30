import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/services/authService';
import { toggleFavourite } from '@/lib/services/documentService';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function POST(
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
    return apiError('UNAUTHORIZED', 'Authentication required to favorite documents', 401);
  }

  try {
    const result = await toggleFavourite(supabase, id, user.id, true);
    return apiSuccess(result, 'Document added to favorites');
  } catch (err: any) {
    return apiError('INTERNAL_ERROR', err.message || 'Failed to favorite document', 500);
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
    return apiError('UNAUTHORIZED', 'Authentication required to unfavorite documents', 401);
  }

  try {
    const result = await toggleFavourite(supabase, id, user.id, false);
    return apiSuccess(result, 'Document removed from favorites');
  } catch (err: any) {
    return apiError('INTERNAL_ERROR', err.message || 'Failed to unfavorite document', 500);
  }
}
