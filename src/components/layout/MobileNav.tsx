'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Library, FileText, Search, HardDrive } from 'lucide-react';
import styles from './MobileNav.module.css';

export function MobileNav() {
  const pathname = usePathname();
  const isReader = pathname?.startsWith('/reader/');

  if (isReader) return null;

  return (
    <nav className={styles.mobileNav} aria-label="Mobile Navigation">
      <div className={styles.inner}>
        <Link
          href="/dashboard"
          className={`${styles.navItem} ${pathname === '/dashboard' ? styles.active : ''}`}
        >
          <LayoutDashboard size={19} />
          <span>Dashboard</span>
        </Link>
        <Link
          href="/library"
          className={`${styles.navItem} ${pathname === '/library' ? styles.active : ''}`}
        >
          <Library size={19} />
          <span>Library</span>
        </Link>
        <Link
          href="/notes"
          className={`${styles.navItem} ${pathname === '/notes' ? styles.active : ''}`}
        >
          <FileText size={19} />
          <span>Notes</span>
        </Link>
        <Link
          href="/search"
          className={`${styles.navItem} ${pathname === '/search' ? styles.active : ''}`}
        >
          <Search size={19} />
          <span>Search</span>
        </Link>
        <Link
          href="/storage"
          className={`${styles.navItem} ${pathname === '/storage' ? styles.active : ''}`}
        >
          <HardDrive size={19} />
          <span>Storage</span>
        </Link>
      </div>
    </nav>
  );
}
