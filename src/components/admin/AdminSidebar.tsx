'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  UploadCloud,
  Clock,
  Files,
  FolderTree,
  CheckCircle2,
  XCircle,
  History,
  Settings,
  LogOut,
  Shield,
  Menu,
  X,
  ExternalLink,
} from 'lucide-react';

interface AdminSidebarProps {
  username?: string;
}

export function AdminSidebar({ username = 'Administrator' }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === '/admin') return pathname === '/admin';
    return pathname?.startsWith(path);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    }
    router.push('/admin/login');
    router.refresh();
  };

  const navLinks = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/uploads', label: 'Telegram Uploads', icon: UploadCloud },
    { href: '/admin/pending', label: 'Pending Review', icon: Clock },
    { href: '/admin/documents', label: 'All Documents', icon: Files },
    { href: '/admin/categories', label: 'Categories', icon: FolderTree },
    { href: '/admin/published', label: 'Published PDFs', icon: CheckCircle2 },
    { href: '/admin/rejected', label: 'Rejected Uploads', icon: XCircle },
    { href: '/admin/activity-logs', label: 'Activity Logs', icon: History },
    { href: '/admin/settings', label: 'Admin Settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Top Bar */}
      <div
        style={{
          display: 'none',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '56px',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-medium)',
          padding: '0 1rem',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 50,
        }}
        className="admin-mobile-bar"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
          <Shield size={18} color="#ef4444" />
          <span>SmartPDF Admin</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}
          aria-label="Toggle Navigation"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      <aside
        style={{
          width: '260px',
          minWidth: '260px',
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-medium)',
          height: '100vh',
          position: 'sticky',
          top: 0,
          display: 'flex',
          flexDirection: 'column',
          zIndex: 40,
        }}
      >
        {/* Brand Header */}
        <div
          style={{
            padding: '1.5rem',
            borderBottom: '1px solid var(--border-medium)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ef4444',
            }}
          >
            <Shield size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>
              Admin Console
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Logged in as {username}
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav
          style={{
            flex: 1,
            padding: '1rem 0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
            overflowY: 'auto',
          }}
        >
          {navLinks.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  fontWeight: active ? 700 : 500,
                  color: active ? '#fff' : 'var(--text-secondary)',
                  background: active ? 'var(--accent-primary)' : 'transparent',
                  transition: 'background 0.15s ease',
                }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer & Logout */}
        <div
          style={{
            padding: '1rem',
            borderTop: '1px solid var(--border-medium)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <Link
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.55rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              textDecoration: 'none',
              background: 'var(--bg-tertiary)',
            }}
          >
            <span>Open Public Site</span>
            <ExternalLink size={13} />
          </Link>

          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.6rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              background: 'rgba(239, 68, 68, 0.08)',
              color: '#ef4444',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              width: '100%',
              textAlign: 'left',
            }}
          >
            <LogOut size={16} />
            <span>Sign Out Admin</span>
          </button>
        </div>
      </aside>
    </>
  );
}
