import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser, isUserAdmin, getUserProfile } from '@/lib/services/authService';
import { apiSuccess } from '@/lib/api/response';

export async function GET() {
  const supabase = await createClient();
  if (!supabase) {
    return apiSuccess({
      user: null,
      profile: null,
      isAdmin: false,
      isAuthenticated: false,
    }, 'Supabase unconfigured');
  }

  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return apiSuccess({
      user: null,
      profile: null,
      isAdmin: false,
      isAuthenticated: false,
    }, 'Anonymous guest visitor');
  }

  const [isAdmin, profile] = await Promise.all([
    isUserAdmin(supabase, user),
    getUserProfile(supabase, user.id),
  ]);

  return apiSuccess({
    user: {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
    },
    profile,
    isAdmin,
    isAuthenticated: true,
  }, 'User session verified');
}
