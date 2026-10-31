'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BookOpen, Search, UploadCloud, User, Menu, X, LogOut } from 'lucide-react';
import { ThemeToggle } from '../theme/ThemeToggle';
import { api } from '@/lib/api/client';
import { Profile } from '@/lib/types/database';
import styles from './Header.module.css';

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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
          setUserProfile(data.profile);
          setIsAdmin(data.isAdmin);
        } else {
          setIsAuthenticated(false);
          setUserProfile(null);
          setIsAdmin(false);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setIsAuthenticated(false);
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

  const handleLogout = async () => {
    try {
      await api.auth.logout();
      setIsAuthenticated(false);
      setUserProfile(null);
      setIsAdmin(false);
      router.push('/auth/login');
      router.refresh();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  if (isReader) {
    return null; // PDF Reader has its own dedicated top toolbar
  }

  return (
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
            <UploadCloud size={15} />
            <span>Submit PDF</span>
          </Link>

          <ThemeToggle />

          {isAuthenticated ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
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
                onClick={handleLogout}
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
  );
}
