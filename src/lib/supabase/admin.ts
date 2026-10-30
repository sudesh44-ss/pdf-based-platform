import { createClient } from '@supabase/supabase-js';

/**
 * Server-only administrative Supabase client using SUPABASE_SERVICE_ROLE_KEY.
 *
 * CRITICAL SECURITY RULES:
 * 1. NEVER import or call this in client components or browser code.
 * 2. ALWAYS verify user authentication and admin authorization (e.g. isUserAdmin)
 *    before invoking any administrative database operation.
 */
export function createAdminClient() {
  if (typeof window !== 'undefined') {
    throw new Error('FATAL SECURITY ERROR: createAdminClient cannot be invoked on the client side.');
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export const getAdminClient = createAdminClient;
