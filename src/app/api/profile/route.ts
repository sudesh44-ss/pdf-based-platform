import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser, getUserProfile, updateUserProfile } from '@/lib/services/authService';
import { apiSuccess, apiError } from '@/lib/api/response';
import { z } from 'zod';

const updateProfileSchema = z.object({
  full_name: z.string().max(100).optional(),
  avatar_url: z.string().url().max(500).nullable().optional(),
}).strict(); // Enforce strict schema to prevent mass assignment

export async function GET() {
  const supabase = await createClient();
  if (!supabase) {
    return apiError('CONFIGURATION_ERROR', 'Supabase credentials are not configured', 503);
  }

  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return apiError('UNAUTHORIZED', 'Authentication required', 401);
  }

  const profile = await getUserProfile(supabase, user.id);
  if (!profile) {
    return apiError('NOT_FOUND', 'User profile not found', 404);
  }

  return apiSuccess(profile);
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return apiError('CONFIGURATION_ERROR', 'Supabase credentials are not configured', 503);
  }

  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return apiError('UNAUTHORIZED', 'Authentication required', 401);
  }

  try {
    const body = await request.json();
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', parsed.error.issues[0].message, 422, parsed.error.issues);
    }

    const updated = await updateUserProfile(supabase, user.id, parsed.data);
    if (!updated) {
      return apiError('INTERNAL_ERROR', 'Failed to update profile', 500);
    }

    return apiSuccess(updated, 'Profile updated successfully');
  } catch (err: any) {
    return apiError('BAD_REQUEST', err.message || 'Invalid request body', 400);
  }
}
