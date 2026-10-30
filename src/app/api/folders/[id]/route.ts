import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/services/authService';
import { getFolderById, updateFolder, deleteFolder } from '@/lib/services/foldersService';
import { apiSuccess, apiError } from '@/lib/api/response';
import { z } from 'zod';

const updateFolderSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
}).strict();

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

  const folder = await getFolderById(supabase, id, user.id);
  if (!folder) {
    return apiError('NOT_FOUND', 'Folder not found or unauthorized', 404);
  }

  return apiSuccess(folder);
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
    const parsed = updateFolderSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', parsed.error.issues[0].message, 422, parsed.error.issues);
    }

    const updated = await updateFolder(supabase, id, parsed.data, user.id);
    if (!updated) {
      return apiError('NOT_FOUND', 'Folder not found or unauthorized', 404);
    }

    return apiSuccess(updated, 'Folder updated successfully');
  } catch (err: any) {
    return apiError('INTERNAL_ERROR', err.message || 'Failed to update folder', 500);
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
    await deleteFolder(supabase, id, user.id);
    return apiSuccess({ deleted: true }, 'Folder deleted successfully');
  } catch (err: any) {
    return apiError('INTERNAL_ERROR', err.message || 'Failed to delete folder', 500);
  }
}
