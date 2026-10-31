'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AccountSwitchModal } from '@/components/auth/AccountSwitchModal';
import { api } from '@/lib/api/client';

function AccountSwitchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const target = (searchParams.get('target') as 'admin' | 'user') || 'admin';
  const next = searchParams.get('next') || (target === 'admin' ? '/admin/login' : '/dashboard');
  const from = searchParams.get('from') || (target === 'admin' ? '/dashboard' : '/admin');

  const [userId, setUserId] = useState<string | undefined>(undefined);

  // Background non-blocking check for local notes sync pending status
  useEffect(() => {
    if (target === 'admin') {
      api.auth
        .getMe()
        .then((data) => {
          if (data.user?.id) {
            setUserId(data.user.id);
          }
        })
        .catch(() => {});
    }
  }, [target]);

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
          router.push(from);
        }}
      />
    </div>
  );
}

export default function AccountSwitchPage() {
  return (
    <Suspense fallback={null}>
      <AccountSwitchContent />
    </Suspense>
  );
}
