import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser, isUserAdmin } from '@/lib/services/authService';
import { getSubmissions, createSubmission } from '@/lib/services/moderationService';
import { apiSuccess, apiError } from '@/lib/api/response';
import { z } from 'zod';

const contributionSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters').max(200),
  description: z.string().max(2000).optional().default(''),
  file_name: z.string().min(1),
  file_size: z.number().int().positive(),
  categories: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  rights_declared: z.boolean().refine((val) => val === true, {
    message: 'Rights declaration confirmation is required',
  }),
});

export async function GET() {
  const supabase = await createClient();
  if (!supabase) {
    return apiError('CONFIGURATION_ERROR', 'Supabase credentials are not configured', 503);
  }

  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return apiError('UNAUTHORIZED', 'Authentication required to view contributions', 401);
  }

  const isAdmin = await isUserAdmin(supabase, user);

  try {
    const submissions = await getSubmissions(supabase, user.id, isAdmin);
    return apiSuccess({ submissions, total: submissions.length });
  } catch (err: any) {
    return apiError('INTERNAL_ERROR', err.message || 'Failed to retrieve contributions', 500);
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return apiError('CONFIGURATION_ERROR', 'Supabase credentials are not configured', 503);
  }

  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return apiError('UNAUTHORIZED', 'Authentication required to submit contributions', 401);
  }

  try {
    const body = await request.json();
    const parsed = contributionSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', parsed.error.issues[0].message, 422, parsed.error.issues);
    }

    const submission = await createSubmission(supabase, parsed.data, user.id);
    return apiSuccess(submission, 'Contribution submitted for review', 201);
  } catch (err: any) {
    return apiError('BAD_REQUEST', err.message || 'Invalid contribution submission', 400);
  }
}
