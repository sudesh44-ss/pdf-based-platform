'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AccountSwitchModal } from '@/components/auth/AccountSwitchModal';
import { api } from '@/lib/api/client';
import { Loader2 } from 'lucide-react';

function AccountSwitchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const target = (searchParams.get('target') as 'admin' | 'user') || 'admin';
  const next = searchParams.get('next') || (target === 'admin' ? '/admin/login' : '/dashboard');

  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    api.auth
      .getMe()
      .then((data) => {
        if (!mounted) return;
        if (data.user?.id) {
          setUserId(data.user.id);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-primary)',
          color: 'var(--text-secondary)',
          gap: '0.65rem',
        }}
      >
        <Loader2 className="animate-spin" size={24} />
        <span>Verifying active browser session...</span>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        background: 'var(--bg-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <AccountSwitchModal
        isOpen={true}
        targetRole={target}
        nextUrl={next}
        currentUserId={userId}
        onCancel={() => {
          if (target === 'admin') {
            router.push('/dashboard');
          } else {
            router.push('/admin');
          }
        }}
      />
    </div>
  );
}

export default function AccountSwitchPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-primary)',
            color: 'var(--text-secondary)',
          }}
        >
          <Loader2 className="animate-spin" size={24} />
        </div>
      }
    >
      <AccountSwitchContent />
    </Suspense>
  );
}
