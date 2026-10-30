import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/services/authService';
import { getFolders, createFolder } from '@/lib/services/foldersService';
import { apiSuccess, apiError } from '@/lib/api/response';
import { z } from 'zod';

const createFolderSchema = z.object({
  name: z.string().min(1, 'Folder name is required').max(100),
  color: z.string().default('#3b82f6'),
  icon: z.string().default('folder'),
});

export async function GET() {
  const supabase = await createClient();
  if (!supabase) {
    return apiError('CONFIGURATION_ERROR', 'Supabase credentials are not configured', 503);
  }

  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return apiError('UNAUTHORIZED', 'Authentication required to view folders', 401);
  }

  try {
    const folders = await getFolders(supabase, user.id);
    return apiSuccess({ folders, total: folders.length });
  } catch (err: any) {
    return apiError('INTERNAL_ERROR', err.message || 'Failed to retrieve folders', 500);
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return apiError('CONFIGURATION_ERROR', 'Supabase credentials are not configured', 503);
  }

  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return apiError('UNAUTHORIZED', 'Authentication required to create folders', 401);
  }

  try {
    const body = await request.json();
    const parsed = createFolderSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', parsed.error.issues[0].message, 422, parsed.error.issues);
    }

    const folder = await createFolder(supabase, parsed.data, user.id);
    return apiSuccess(folder, 'Folder created successfully', 201);
  } catch (err: any) {
    return apiError('BAD_REQUEST', err.message || 'Invalid folder request', 400);
  }
}
