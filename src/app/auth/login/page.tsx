'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, ShieldCheck, ArrowRight, UserCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import styles from './page.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setMessage(null);

    const supabase = createClient();
    if (!supabase) {
      // In local dev without live Supabase OAuth keys configured, provide seamless developer session
      setMessage('Supabase OAuth keys not detected. Activating instant developer session...');
      setTimeout(() => {
        router.push('/dashboard');
      }, 1000);
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setMessage(`OAuth Error: ${error.message}`);
        setLoading(false);
      }
    } catch (e: any) {
      setMessage(`Login Error: ${e.message}`);
      setLoading(false);
    }
  };

  const handleDemoSignIn = () => {
    setLoading(true);
    setTimeout(() => {
      router.push('/dashboard');
    }, 600);
  };

  return (
    <div className={styles.container}>
      <div className={styles.authCard}>
        <div className={styles.brandIcon}>
          <BookOpen size={26} />
        </div>

        <div>
          <h1 className={styles.title}>Welcome Back</h1>
          <p className={styles.subtitle}>
            Sign in to access your personal PDF library, private annotations, and Telegram-backed notebooks.
          </p>
        </div>

        {message && (
          <div style={{ padding: '0.75rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', fontSize: '0.825rem', color: 'var(--accent-info)' }}>
            {message}
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
          <span>{loading ? 'Connecting...' : 'Continue with Google'}</span>
        </button>

        <div className={styles.divider}>or evaluate as guest</div>

        <button
          type="button"
          className={styles.demoBtn}
          onClick={handleDemoSignIn}
          disabled={loading}
        >
          <UserCheck size={16} />
          <span>Enter Demo Workspace</span>
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
