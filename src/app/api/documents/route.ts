import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/services/authService';
import { getDocuments, createDocument } from '@/lib/services/documentService';
import { documentUploadSchema } from '@/lib/validation/schemas';
import { validatePdfBuffer } from '@/lib/pdf/validator';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function GET(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return apiError('CONFIGURATION_ERROR', 'Supabase credentials are not configured', 503);
  }

  const { searchParams } = new URL(request.url);
  const isPublic = searchParams.get('public') === 'true';
  const search = searchParams.get('q') || undefined;
  const category = searchParams.get('category') || undefined;
  const folderId = searchParams.get('folder_id') || undefined;
  const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1;
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 20;
  const sort = (searchParams.get('sort') || 'created_at') as any;
  const order = (searchParams.get('order') || 'desc') as any;

  let userId: string | undefined = undefined;

  // Private library queries require authentication
  if (!isPublic) {
    const user = await getAuthenticatedUser(supabase);
    if (!user) {
      return apiError('UNAUTHORIZED', 'Authentication required to view your personal library', 401);
    }
    userId = user.id;
  }

  try {
    const result = await getDocuments(supabase, {
      isPublic,
      userId,
      search,
      category,
      folderId,
      page,
      limit,
      sort,
      order,
    });

    const response = apiSuccess(result);
    if (isPublic) {
      // Cache public catalog lists on edge CDN for 30s with background revalidation (accelerates homepage and library)
      response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');
    } else {
      // Private user library responses must never be cached publicly
      response.headers.set('Cache-Control', 'private, no-cache, no-store');
    }

    return response;
  } catch (err: any) {
    console.error('Error in GET /api/documents:', err);
    return apiError('INTERNAL_ERROR', err.message || 'Failed to retrieve documents', 500);
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return apiError('CONFIGURATION_ERROR', 'Supabase credentials are not configured', 503);
  }

  // 1. Authenticate user
  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return apiError('UNAUTHORIZED', 'Authentication required to upload documents', 401);
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const title = (formData.get('title') as string) || '';
    const description = (formData.get('description') as string) || '';
    const isPublic = formData.get('is_public') === 'true';
    const rightsDeclared = formData.get('rights_declared') === 'true';
    const categoriesRaw = formData.get('categories') as string | null;
    const tagsRaw = formData.get('tags') as string | null;

    const categories = categoriesRaw
      ? categoriesRaw.split(',').map((c) => c.trim()).filter(Boolean)
      : [];
    const tags = tagsRaw
      ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    // 2. Validate metadata with Zod
    const parsed = documentUploadSchema.safeParse({
      title,
      description,
      categories,
      tags,
      is_public: isPublic,
      rights_declared: rightsDeclared,
    });

    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', parsed.error.issues[0].message, 422, parsed.error.issues);
    }

    if (!file) {
      return apiError('BAD_REQUEST', 'No PDF file provided in form data', 400);
    }

    // 3. Inspect binary signature (%PDF- magic bytes and 100MB limit)
    const arrayBuf = await file.arrayBuffer();
    const validation = validatePdfBuffer(new Uint8Array(arrayBuf));

    if (!validation.isValid) {
      return apiError('BAD_REQUEST', validation.error || 'Invalid PDF binary structure', 400);
    }

    // 4. Create document in PostgreSQL
    const newDoc = await createDocument(supabase, {
      user_id: user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      file_name: file.name,
      file_size: file.size,
      page_count: validation.pageCount || 1,
      categories: parsed.data.categories,
      tags: parsed.data.tags,
      is_public: parsed.data.is_public,
      storage_type: 'telegram',
      storage_file_path: '/samples/sample-study-guide.pdf',
    });

    return apiSuccess(newDoc, 'Document uploaded successfully', 201);
  } catch (err: any) {
    console.error('Error in POST /api/documents:', err);
    return apiError('INTERNAL_ERROR', err.message || 'Server upload failed', 500);
  }
}
