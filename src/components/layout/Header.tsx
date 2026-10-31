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
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // In the reader view, we can render a minimal or hidden header if needed
  const isReader = pathname?.startsWith('/reader/');

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

  const handleManualSync = async () => {
    if (!userId || isSyncing) return;
    setIsSyncing(true);
    setSyncFeedback(null);

    try {
      const pendingData = await localSync.getPendingChanges(userId);
      const res = await api.sync.pushPending({
        dirtyNotes: pendingData.dirtyNotes,
        dirtyProgress: pendingData.dirtyProgress,
        dirtyHistory: pendingData.dirtyHistory,
      });

      await localSync.applyServerSnapshot(userId, {
        notes: res.notes,
        readingProgress: res.readingProgress,
        readingHistory: res.readingHistory,
        serverTimestamp: res.serverTimestamp,
      });

      setSyncFeedback('Synced');
      setTimeout(() => setSyncFeedback(null), 3000);
    } catch (err: any) {
      console.error('Manual cloud sync failed:', err);
      setSyncFeedback('Error');
      setTimeout(() => setSyncFeedback(null), 3000);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogoutSuccess = () => {
    setLogoutModalOpen(false);
    setIsAuthenticated(false);
    setUserId(null);
    setUserProfile(null);
    setIsAdmin(false);
    router.push('/auth/login');
    router.refresh();
  };

  if (isReader) {
    return null; // PDF Reader has its own dedicated top toolbar
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
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  className={styles.userBtn}
                  title="Manual Cloud Sync (Sync Local Notes & Reading Progress)"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.35rem 0.65rem',
                    fontSize: '0.785rem',
                    fontWeight: 600,
                    color: syncFeedback === 'Synced' ? '#10b981' : syncFeedback === 'Error' ? '#ef4444' : 'var(--text-secondary)',
                    borderRadius: '8px',
                  }}
                >
                  {isSyncing ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : syncFeedback === 'Synced' ? (
                    <Check size={15} color="#10b981" />
                  ) : (
                    <CloudUpload size={15} />
                  )}
                  <span>{syncFeedback ? syncFeedback : isSyncing ? 'Syncing...' : 'Sync'}</span>
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
                  onClick={() => setLogoutModalOpen(true)}
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

      {/* Logout Confirmation Modal */}
      {userId && (
        <LogoutConfirmModal
          isOpen={logoutModalOpen}
          userId={userId}
          onClose={() => setLogoutModalOpen(false)}
          onLogoutSuccess={handleLogoutSuccess}
        />
      )}
    </>
  );
}
