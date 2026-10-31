import { getAdminClient } from '@/lib/supabase/admin';
import { Category } from '@/lib/types/database';

let categoriesCache: { data: Category[]; expiresAt: number } | null = null;
const CATEGORIES_CACHE_TTL_MS = 60 * 1000; // 60 seconds

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim();
}

export async function listCategories(includeHidden: boolean = false): Promise<Category[]> {
  const now = Date.now();
  if (!includeHidden && categoriesCache && categoriesCache.expiresAt > now) {
    return categoriesCache.data;
  }

  const adminClient = getAdminClient();
  if (!adminClient) return [];

  let query = adminClient.from('categories').select('*').order('name', { ascending: true });

  if (!includeHidden) {
    query = query.eq('is_visible', true);
  }

  const { data, error } = await query;
  if (error || !data) {
    console.error('Error listing categories:', error);
    return [];
  }

  const result = data as Category[];
  if (!includeHidden) {
    categoriesCache = { data: result, expiresAt: now + CATEGORIES_CACHE_TTL_MS };
  }

  return result;
}

export async function createCategory(data: {
  name: string;
  slug?: string;
  description?: string;
  color?: string;
  icon?: string;
}): Promise<Category | null> {
  categoriesCache = null; // Invalidate cache
  const adminClient = getAdminClient();
  if (!adminClient) return null;

  const name = data.name.trim();
  const slug = data.slug?.trim() || slugify(name);

  const { data: created, error } = await adminClient
    .from('categories')
    .insert({
      name,
      slug,
      description: data.description?.trim() || null,
      color: data.color || '#3b82f6',
      icon: data.icon || 'folder',
      is_visible: true,
    })
    .select('*')
    .single();

  if (error || !created) {
    console.error('Error creating category:', error);
    throw new Error(error?.message || 'Failed to create category');
  }

  return created as Category;
}

export async function updateCategory(
  id: string,
  updates: Partial<Category>
): Promise<Category | null> {
  categoriesCache = null; // Invalidate cache
  const adminClient = getAdminClient();
  if (!adminClient) return null;

  const payload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.name) {
    payload.name = updates.name.trim();
    payload.slug = updates.slug?.trim() || slugify(updates.name);
  }
  if (updates.description !== undefined) payload.description = updates.description?.trim() || null;
  if (updates.color) payload.color = updates.color;
  if (updates.icon) payload.icon = updates.icon;
  if (updates.is_visible !== undefined) payload.is_visible = updates.is_visible;

  const { data, error } = await adminClient
    .from('categories')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    console.error('Error updating category:', error);
    throw new Error(error?.message || 'Failed to update category');
  }

  return data as Category;
}

export async function deleteCategory(id: string): Promise<boolean> {
  const adminClient = getAdminClient();
  if (!adminClient) return false;

  // 1. Get category name
  const { data: cat } = await adminClient
    .from('categories')
    .select('name')
    .eq('id', id)
    .maybeSingle();

  if (!cat) return false;

  // 2. Check if documents reference this category
  const { count, error: countErr } = await adminClient
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .contains('categories', [cat.name])
    .eq('is_trash', false);

  if (countErr) {
    console.error('Error checking category documents:', countErr);
  }

  if (count && count > 0) {
    throw new Error(
      `Cannot delete category "${cat.name}". It is currently referenced by ${count} documents. Reassign or delete those documents first.`
    );
  }

  const { error } = await adminClient.from('categories').delete().eq('id', id);
  if (error) {
    console.error('Error deleting category:', error);
    throw new Error(error.message);
  }

  categoriesCache = null; // Invalidate cache
  return true;
}
