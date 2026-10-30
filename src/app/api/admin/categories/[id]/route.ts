import { getVerifiedAdminSession, logAdminActivity } from '@/lib/auth/adminAuth';
import { updateCategory, deleteCategory } from '@/lib/services/categoriesService';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getVerifiedAdminSession();
  if (!session.valid || !session.username) {
    return apiError('UNAUTHORIZED', 'Administrator session required', 401);
  }

  const { id } = await params;
  let body: any;
  try {
    body = await request.json();
  } catch {
    return apiError('INVALID_REQUEST', 'Invalid JSON body', 400);
  }

  try {
    const updated = await updateCategory(id, body);
    if (!updated) {
      return apiError('NOT_FOUND', 'Category not found', 404);
    }

    await logAdminActivity(session.username, 'category_updated', 'category', id, body);

    return apiSuccess(updated, 'Category updated successfully');
  } catch (err: any) {
    return apiError('UPDATE_FAILED', err.message || 'Failed to update category', 400);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getVerifiedAdminSession();
  if (!session.valid || !session.username) {
    return apiError('UNAUTHORIZED', 'Administrator session required', 401);
  }

  const { id } = await params;
  try {
    await deleteCategory(id);
    await logAdminActivity(session.username, 'category_deleted', 'category', id);
    return apiSuccess({ deleted: true }, 'Category deleted successfully');
  } catch (err: any) {
    return apiError('DELETE_BLOCKED', err.message || 'Cannot delete category', 400);
  }
}
