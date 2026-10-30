import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ensureUserProfile } from '@/lib/services/authService';
import { sanitizeRedirect } from '@/middleware';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next');
  const oauthError = searchParams.get('error');
  const oauthErrorDescription = searchParams.get('error_description');

  const safeNext = sanitizeRedirect(next);

  // 1. Handle OAuth provider errors / cancellation
  if (oauthError) {
    console.error('Google OAuth error callback:', oauthError, oauthErrorDescription);
    const redirectUrl = new URL('/auth/login', origin);
    redirectUrl.searchParams.set('error', oauthError);
    if (oauthErrorDescription) {
      redirectUrl.searchParams.set('error_description', oauthErrorDescription);
    }
    return NextResponse.redirect(redirectUrl);
  }

  // 2. Validate that authorization code was received
  if (!code) {
    const redirectUrl = new URL('/auth/login', origin);
    redirectUrl.searchParams.set('error', 'no_code_provided');
    return NextResponse.redirect(redirectUrl);
  }

  // 3. Initialize server Supabase client
  const supabase = await createClient();
  if (!supabase) {
    const redirectUrl = new URL('/auth/login', origin);
    redirectUrl.searchParams.set('error', 'unconfigured');
    return NextResponse.redirect(redirectUrl);
  }

  // 4. Exchange authorization code for session
  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError || !data?.user) {
    console.error('Failed to exchange code for session:', exchangeError);
    const redirectUrl = new URL('/auth/login', origin);
    redirectUrl.searchParams.set('error', 'auth_callback_error');
    return NextResponse.redirect(redirectUrl);
  }

  // 5. Automatically provision or synchronize user profile in public.profiles
  try {
    await ensureUserProfile(supabase, data.user);
  } catch (profileError) {
    console.error('Error synchronizing user profile after login:', profileError);
  }

  // 6. Redirect to sanitized destination
  return NextResponse.redirect(`${origin}${safeNext}`);
}
