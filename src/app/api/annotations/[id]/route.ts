import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/services/authService';
import { updateAnnotation, deleteAnnotation } from '@/lib/services/annotationsService';
import { apiSuccess, apiError } from '@/lib/api/response';
import { z } from 'zod';

const updateAnnotationSchema = z.object({
  color: z.string().optional(),
  rects: z.array(z.any()).optional(),
  content: z.string().nullable().optional(),
}).strict();

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
    const parsed = updateAnnotationSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', parsed.error.issues[0].message, 422, parsed.error.issues);
    }

    const updated = await updateAnnotation(supabase, id, parsed.data, user.id);
    return apiSuccess(updated, 'Annotation updated successfully');
  } catch (err: any) {
    return apiError('INTERNAL_ERROR', err.message || 'Failed to update annotation', 500);
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
    await deleteAnnotation(supabase, id, user.id);
    return apiSuccess({ deleted: true }, 'Annotation deleted successfully');
  } catch (err: any) {
    return apiError('INTERNAL_ERROR', err.message || 'Failed to delete annotation', 500);
  }
}
