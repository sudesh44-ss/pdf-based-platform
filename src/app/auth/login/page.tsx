'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, AlertCircle, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import styles from './page.module.css';

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/dashboard';
  const urlError = searchParams.get('error');
  const urlErrorDescription = searchParams.get('error_description');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    if (
      urlErrorDescription?.toLowerCase().includes('provider is not enabled') ||
      urlError?.toLowerCase().includes('provider')
    ) {
      setErrorMessage(
        'Google Provider is not enabled in your Supabase project. Go to Supabase Dashboard > Authentication > Providers > Google, toggle it ON, and add your Google OAuth Client ID & Secret.'
      );
    } else if (urlError === 'unconfigured') {
      setErrorMessage(
        'Supabase authentication is not configured. Please define NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment.'
      );
    } else if (urlError === 'unauthorized_admin') {
      setErrorMessage(
        'Access denied: Your account is not authorized for the Administration Portal.'
      );
    } else if (urlError === 'auth_callback_error') {
      setErrorMessage(
        'Authentication failed during the OAuth code exchange. Please try signing in again.'
      );
    } else if (urlError === 'access_denied') {
      setInfoMessage('Google OAuth sign-in was cancelled or denied.');
    } else if (urlError) {
      setErrorMessage(urlErrorDescription || `Authentication notice: ${urlError}`);
    }
  }, [urlError, urlErrorDescription]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMessage(null);
    setInfoMessage(null);

    if (!isSupabaseConfigured()) {
      setErrorMessage(
        'Supabase credentials missing. Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local to enable Google OAuth.'
      );
      setLoading(false);
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setErrorMessage('Could not initialize Supabase browser client.');
      setLoading(false);
      return;
    }

    try {
      // Validate and sanitize the redirect destination
      const safeNext =
        next.startsWith('/') &&
        !next.startsWith('//') &&
        !next.startsWith('/\\') &&
        !next.includes(':')
          ? next
          : '/dashboard';

      const callbackUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });

      if (error) {
        if (
          error.message?.toLowerCase().includes('provider is not enabled') ||
          error.message?.toLowerCase().includes('unsupported provider')
        ) {
          setErrorMessage(
            'Google Provider is not enabled in your Supabase project. Go to Supabase Dashboard > Authentication > Providers > Google, toggle it ON, and add your Google OAuth Client ID & Secret.'
          );
        } else {
          setErrorMessage(`OAuth Error: ${error.message}`);
        }
        setLoading(false);
      }
    } catch (e: any) {
      setErrorMessage(`Login Error: ${e.message || 'An unexpected error occurred'}`);
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.authCard}>
        <div className={styles.brandIcon}>
          <BookOpen size={26} />
        </div>

        <div>
          <h1 className={styles.title}>Welcome to SmartPDF</h1>
          <p className={styles.subtitle}>
            Sign in with your Google account to access your personal PDF library, private annotations, and Telegram-backed notebooks.
          </p>
        </div>

        {errorMessage && (
          <div
            style={{
              padding: '0.85rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.825rem',
              color: 'var(--accent-danger, #ef4444)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem',
              textAlign: 'left',
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {infoMessage && (
          <div
            style={{
              padding: '0.85rem',
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.825rem',
              color: 'var(--accent-info, #3b82f6)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem',
              textAlign: 'left',
            }}
          >
            <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{infoMessage}</span>
          </div>
        )}

        <button
          type="button"
          className={styles.googleBtn}
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>{loading ? 'Connecting to Google OAuth...' : 'Continue with Google'}</span>
        </button>

        <p className={styles.notice}>
          By continuing, you acknowledge our{' '}
          <Link href="/terms" style={{ color: 'var(--accent-primary)' }}>Terms of Service</Link>{' '}
          and{' '}
          <Link href="/privacy" style={{ color: 'var(--accent-primary)' }}>Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.container}>
          <div className={styles.authCard}>
            <div className={styles.brandIcon}>
              <BookOpen size={26} />
            </div>
            <div>
              <h1 className={styles.title}>Loading authentication...</h1>
            </div>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
