import { getVerifiedAdminSession, logAdminActivity } from '@/lib/auth/adminAuth';
import { listCategories, createCategory } from '@/lib/services/categoriesService';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function GET(_request: Request) {
  const session = await getVerifiedAdminSession();
  if (!session.valid) {
    return apiError('UNAUTHORIZED', 'Administrator session required', 401);
  }

  try {
    const categories = await listCategories(true);
    return apiSuccess({ categories });
  } catch (err: any) {
    return apiError('INTERNAL_ERROR', err.message || 'Failed to list categories', 500);
  }
}

export async function POST(request: Request) {
  const session = await getVerifiedAdminSession();
  if (!session.valid || !session.username) {
    return apiError('UNAUTHORIZED', 'Administrator session required', 401);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return apiError('INVALID_REQUEST', 'Invalid JSON body', 400);
  }

  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    return apiError('VALIDATION_ERROR', 'Category name is required', 400);
  }

  try {
    const created = await createCategory(body);
    if (!created) {
      return apiError('INTERNAL_ERROR', 'Failed to create category', 500);
    }

    await logAdminActivity(session.username, 'category_created', 'category', created.id, {
      name: created.name,
    });

    return apiSuccess(created, 'Category created successfully', 201);
  } catch (err: any) {
    console.error('Error creating category:', err);
    return apiError('CONFLICT', err.message || 'Category creation failed', 409);
  }
}
