import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/services/authService';
import { addDocumentToFolder, removeDocumentFromFolder } from '@/lib/services/foldersService';
import { apiSuccess, apiError } from '@/lib/api/response';
import { z } from 'zod';

const folderDocSchema = z.object({
  document_id: z.string().uuid(),
});

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
    return apiError('UNAUTHORIZED', 'Authentication required', 401);
  }

  try {
    const body = await request.json();
    const parsed = folderDocSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', parsed.error.issues[0].message, 422, parsed.error.issues);
    }

    await addDocumentToFolder(supabase, id, parsed.data.document_id, user.id);
    return apiSuccess({ success: true }, 'Document added to folder', 201);
  } catch (err: any) {
    if (err.message === 'FOLDER_NOT_FOUND') {
      return apiError('NOT_FOUND', 'Folder not found or unauthorized', 404);
    }
    return apiError('INTERNAL_ERROR', err.message || 'Failed to add document to folder', 500);
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

  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get('document_id');

  if (!documentId) {
    return apiError('BAD_REQUEST', 'Missing document_id query parameter', 400);
  }

  try {
    await removeDocumentFromFolder(supabase, id, documentId, user.id);
    return apiSuccess({ removed: true }, 'Document removed from folder');
  } catch (err: any) {
    if (err.message === 'FOLDER_NOT_FOUND') {
      return apiError('NOT_FOUND', 'Folder not found or unauthorized', 404);
    }
    return apiError('INTERNAL_ERROR', err.message || 'Failed to remove document from folder', 500);
  }
}
