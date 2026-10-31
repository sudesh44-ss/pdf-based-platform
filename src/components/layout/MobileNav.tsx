'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Library, FolderOpen, Search, User } from 'lucide-react';
import styles from './MobileNav.module.css';

export function MobileNav() {
  const pathname = usePathname();
  const isReader = pathname?.startsWith('/reader/');
  const isAdminRoute = pathname?.startsWith('/admin');
  const isSwitchRoute = pathname?.startsWith('/auth/switch');

  if (isReader || isAdminRoute || isSwitchRoute) return null;

  return (
    <nav className={styles.mobileNav} aria-label="Mobile Navigation">
      <div className={styles.inner}>
        <Link
          href="/dashboard"
          className={`${styles.navItem} ${pathname === '/dashboard' ? styles.active : ''}`}
        >
          <LayoutDashboard size={19} />
          <span>Feed</span>
        </Link>
        <Link
          href="/library"
          className={`${styles.navItem} ${pathname === '/library' ? styles.active : ''}`}
        >
          <Library size={19} />
          <span>Library</span>
        </Link>
        <Link
          href="/my-library"
          className={`${styles.navItem} ${pathname === '/my-library' ? styles.active : ''}`}
        >
          <FolderOpen size={19} />
          <span>My PDFs</span>
        </Link>
        <Link
          href="/search"
          className={`${styles.navItem} ${pathname === '/search' ? styles.active : ''}`}
        >
          <Search size={19} />
          <span>Search</span>
        </Link>
        <Link
          href="/profile"
          className={`${styles.navItem} ${pathname === '/profile' ? styles.active : ''}`}
        >
          <User size={19} />
          <span>Profile</span>
        </Link>
      </div>
    </nav>
  );
}
