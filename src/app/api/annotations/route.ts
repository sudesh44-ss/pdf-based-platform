import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/services/authService';
import { getAnnotations, createAnnotation } from '@/lib/services/annotationsService';
import { annotationSchema } from '@/lib/validation/schemas';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function GET(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return apiError('CONFIGURATION_ERROR', 'Supabase credentials are not configured', 503);
  }

  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return apiError('UNAUTHORIZED', 'Authentication required to view annotations', 401);
  }

  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get('document_id');
  const pageNumber = searchParams.has('page_number')
    ? parseInt(searchParams.get('page_number')!, 10)
    : undefined;

  if (!documentId) {
    return apiError('BAD_REQUEST', 'Missing required query parameter: document_id', 400);
  }

  try {
    const annotations = await getAnnotations(supabase, user.id, documentId, pageNumber);
    return apiSuccess({ annotations, total: annotations.length });
  } catch (err: any) {
    return apiError('INTERNAL_ERROR', err.message || 'Failed to retrieve annotations', 500);
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return apiError('CONFIGURATION_ERROR', 'Supabase credentials are not configured', 503);
  }

  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return apiError('UNAUTHORIZED', 'Authentication required to create annotations', 401);
  }

  try {
    const body = await request.json();
    const parsed = annotationSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', parsed.error.issues[0].message, 422, parsed.error.issues);
    }

    const annotation = await createAnnotation(supabase, parsed.data, user.id);
    return apiSuccess(annotation, 'Annotation created successfully', 201);
  } catch (err: any) {
    return apiError('BAD_REQUEST', err.message || 'Invalid annotation request', 400);
  }
}
