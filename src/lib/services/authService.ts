import { SupabaseClient, User } from '@supabase/supabase-js';
import { Profile } from '../types/database';

/**
 * Retrieves the currently authenticated Supabase user using secure token validation.
 * Uses `getUser()` instead of `getSession()` to ensure the JWT signature is verified server-side.
 */
export async function getAuthenticatedUser(supabase: SupabaseClient | null): Promise<User | null> {
  if (!supabase) return null;
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user;
  } catch {
    return null;
  }
}

/**
 * Determines whether a user is an administrator via server-side role check or ADMIN_EMAILS.
 * Never trusts a role sent from the browser.
 */
export async function isUserAdmin(
  supabase: SupabaseClient | null,
  user: User | null
): Promise<boolean> {
  if (!user) return false;

  // 1. Check ADMIN_EMAILS environment variable
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (user.email && adminEmails.includes(user.email.toLowerCase())) {
    return true;
  }

  // 2. Check profile role in database
  if (!supabase) return false;
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    return profile?.role === 'admin' || profile?.role === 'moderator';
  } catch {
    return false;
  }
}

/**
 * Synchronizes Supabase auth.users with public.profiles safely.
 * Prevents duplicate profile creation and protects privileged fields like role.
 */
export async function ensureUserProfile(
  supabase: SupabaseClient,
  user: User
): Promise<Profile | null> {
  try {
    // Check if profile already exists
    const { data: existing } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (existing) {
      return existing as Profile;
    }

    const adminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const isAdmin = user.email && adminEmails.includes(user.email.toLowerCase());

    const fullName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split('@')[0] ||
      '';
    const avatarUrl =
      user.user_metadata?.avatar_url ||
      user.user_metadata?.picture ||
      null;

    const { data: created, error } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email || '',
        full_name: fullName,
        avatar_url: avatarUrl,
        role: isAdmin ? 'admin' : 'user',
      })
      .select('*')
      .single();

    if (error) {
      // In case of race condition or trigger already inserted
      const { data: refetched } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      return refetched as Profile | null;
    }

    return created as Profile;
  } catch (err) {
    console.error('Error ensuring user profile:', err);
    return null;
  }
}

/**
 * Fetches user profile by ID.
 */
export async function getUserProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) return null;
  return data as Profile;
}

/**
 * Updates profile fields with strict privilege isolation (cannot modify role, id, or email).
 */
export async function updateUserProfile(
  supabase: SupabaseClient,
  userId: string,
  updates: { full_name?: string; avatar_url?: string | null }
): Promise<Profile | null> {
  const sanitized: { full_name?: string; avatar_url?: string | null; updated_at: string } = {
    updated_at: new Date().toISOString(),
  };

  if (typeof updates.full_name === 'string') {
    sanitized.full_name = updates.full_name.trim();
  }
  if (typeof updates.avatar_url !== 'undefined') {
    sanitized.avatar_url = updates.avatar_url;
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(sanitized)
    .eq('id', userId)
    .select('*')
    .single();

  if (error || !data) return null;
  return data as Profile;
}
