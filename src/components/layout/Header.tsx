'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BookOpen,
  Search,
  Send,
  User,
  Menu,
  X,
  LogOut,
  CloudUpload,
  Loader2,
  Check,
} from 'lucide-react';
import { ThemeToggle } from '../theme/ThemeToggle';
import { LogoutConfirmModal } from '../auth/LogoutConfirmModal';
import { api } from '@/lib/api/client';
import { localSync } from '@/lib/storage/indexedDb';
import { Profile } from '@/lib/types/database';
import styles from './Header.module.css';

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncModalMode, setSyncModalMode] = useState<'logout' | 'manual'>('logout');

  // Hide header in reader view, admin panel, or account switch screen to prevent layout collisions
  const isReader = pathname?.startsWith('/reader/');
  const isAdminRoute = pathname?.startsWith('/admin');
  const isSwitchRoute = pathname?.startsWith('/auth/switch');

  useEffect(() => {
    let isMounted = true;
    api.auth
      .getMe()
      .then((data) => {
        if (!isMounted) return;
        if (data.user) {
          setIsAuthenticated(true);
          setUserId(data.user.id);
          setUserProfile(data.profile);
          setIsAdmin(data.isAdmin);
        } else {
          setIsAuthenticated(false);
          setUserId(null);
          setUserProfile(null);
          setIsAdmin(false);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setIsAuthenticated(false);
        setUserId(null);
        setUserProfile(null);
        setIsAdmin(false);
      });

    return () => {
      isMounted = false;
    };
  }, [pathname]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleOpenManualSync = () => {
    if (!userId) return;
    setSyncModalMode('manual');
    setSyncModalOpen(true);
  };

  const handleOpenLogout = () => {
    if (!userId) return;
    setSyncModalMode('logout');
    setSyncModalOpen(true);
  };

  const handleLogoutSuccess = () => {
    setSyncModalOpen(false);
    setIsAuthenticated(false);
    setUserId(null);
    setUserProfile(null);
    setIsAdmin(false);
    router.push('/auth/login');
    router.refresh();
  };

  if (isReader || isAdminRoute || isSwitchRoute) {
    return null;
  }

  return (
    <>
      <header className={styles.header}>
        <div className={styles.inner}>
          <div className={styles.left}>
            <Link href="/" className={styles.brand}>
              <div className={styles.brandIcon}>
                <BookOpen size={18} />
              </div>
              <span>OpenShelf</span>
            </Link>
          </div>

          <form className={styles.searchForm} onSubmit={handleSearch}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="search"
              placeholder="Search PDFs &amp; documents..."
              className={styles.searchInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </form>

          <div className={styles.right}>
            <Link href="/my-contributions" className={styles.contributeBtn}>
              <Send size={15} />
              <span>Submit PDF</span>
            </Link>

            <ThemeToggle />

            {isAuthenticated ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                {/* Manual Cloud Sync Button */}
                <button
                  type="button"
                  onClick={handleOpenManualSync}
                  className={styles.userBtn}
                  title="Manual Cloud Sync (Sync Local Notes & Reading Progress)"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.35rem 0.65rem',
                    fontSize: '0.785rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    borderRadius: '8px',
                  }}
                >
                  <CloudUpload size={15} />
                  <span>Sync</span>
                </button>

                <Link
                  href="/profile"
                  className={styles.userBtn}
                  title={`Logged in as ${userProfile?.email || 'User'} - View Profile`}
                >
                  {userProfile?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={userProfile.avatar_url}
                      alt="User"
                      style={{ width: '100%', height: '100%', borderRadius: '50%' }}
                    />
                  ) : (
                    <User size={17} />
                  )}
                </Link>

                <button
                  type="button"
                  onClick={handleOpenLogout}
                  className={styles.userBtn}
                  title="Sign Out"
                  aria-label="Sign Out"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <Link
                href="/auth/login"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.4rem 0.8rem',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                <User size={15} />
                <span>Sign In</span>
              </Link>
            )}

            <button
              type="button"
              className={styles.menuBtn}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* Manual Sync & Logout Confirmation Modal */}
      {userId && (
        <LogoutConfirmModal
          isOpen={syncModalOpen}
          userId={userId}
          mode={syncModalMode}
          onClose={() => setSyncModalOpen(false)}
          onLogoutSuccess={handleLogoutSuccess}
        />
      )}
    </>
  );
}
