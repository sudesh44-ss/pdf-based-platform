import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/services/authService';
import { toggleLike } from '@/lib/services/documentService';
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
    return apiError('UNAUTHORIZED', 'Authentication required to like documents', 401);
  }

  try {
    const result = await toggleLike(supabase, id, user.id, true);
    return apiSuccess(result, 'Document liked');
  } catch (err: any) {
    return apiError('INTERNAL_ERROR', err.message || 'Failed to like document', 500);
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
    return apiError('UNAUTHORIZED', 'Authentication required to unlike documents', 401);
  }

  try {
    const result = await toggleLike(supabase, id, user.id, false);
    return apiSuccess(result, 'Document unliked');
  } catch (err: any) {
    return apiError('INTERNAL_ERROR', err.message || 'Failed to unlike document', 500);
  }
}
