import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // If not configured, returns null; client code can fallback gracefully to in-memory store
    return null;
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
