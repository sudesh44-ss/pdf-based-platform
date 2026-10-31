'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminSidebar } from './AdminSidebar';
import { AccountSwitchModal } from '@/components/auth/AccountSwitchModal';
import { api } from '@/lib/api/client';
import { Loader2 } from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [username, setUsername] = useState<string>('Administrator');
  const [normalUser, setNormalUser] = useState<{ id: string; email?: string } | null>(null);

  useEffect(() => {
    let mounted = true;

    async function checkSessions() {
      // 1. Check if a Normal User session is active on this browser
      try {
        const userMe = await api.auth.getMe();
        if (mounted && userMe.user) {
          setNormalUser(userMe.user);
          setAuthorized(false);
          return;
        }
      } catch {
        // Ignored
      }

      // 2. Check Admin session
      try {
        const res = await fetch('/api/admin/auth/me');
        if (!res.ok) throw new Error('Not authenticated');
        const data = await res.json();
        if (mounted) {
          setUsername(data.data?.username || 'Administrator');
          setAuthorized(true);
        }
      } catch {
        if (mounted) {
          setAuthorized(false);
          router.replace('/admin/login');
        }
      }
    }

    checkSessions();

    return () => {
      mounted = false;
    };
  }, [router]);

  // Account Switch Prompt: Normal User is logged in on this browser
  if (normalUser) {
    return (
      <AccountSwitchModal
        isOpen={true}
        targetRole="admin"
        currentUserId={normalUser.id}
        nextUrl="/admin"
        onCancel={() => router.push('/dashboard')}
        onSwitchSuccess={() => {
          setNormalUser(null);
          router.refresh();
        }}
      />
    );
  }

  if (authorized === null) {
    return (
      <div
        style={{
          height: '100vh',
          width: '100vw',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-primary)',
          gap: '0.75rem',
          color: 'var(--text-secondary)',
        }}
      >
        <Loader2 className="animate-spin" size={24} />
        <span>Verifying Administrator Credentials...</span>
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%', background: 'var(--bg-primary)' }}>
      <AdminSidebar username={username} />
      <main
        style={{
          flex: 1,
          padding: '2.5rem',
          overflowY: 'auto',
          maxWidth: '1400px',
        }}
      >
        {children}
      </main>
    </div>
  );
}
