import { createClient } from '@/lib/supabase/server';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function POST() {
  const supabase = await createClient();
  if (!supabase) {
    return apiError('CONFIGURATION_ERROR', 'Supabase credentials are not configured', 503);
  }

  // Local scope ensures current browser session is terminated without revoking other device sessions (PC vs Mobile independence)
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) {
    return apiError('INTERNAL_ERROR', error.message, 500);
  }

  return apiSuccess({ loggedOut: true }, 'Signed out successfully');
}
