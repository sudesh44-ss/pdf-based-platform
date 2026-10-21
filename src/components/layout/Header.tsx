'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BookOpen, Search, UploadCloud, Shield, User, Menu, X } from 'lucide-react';
import { ThemeToggle } from '../theme/ThemeToggle';
import styles from './Header.module.css';

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // In the reader view, we can render a minimal or hidden header if needed
  const isReader = pathname?.startsWith('/reader/');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
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
            <span>SmartPDF</span>
          </Link>

          <nav className={styles.navLinks} aria-label="Main Navigation">
            <Link
              href="/library"
              className={`${styles.navLink} ${pathname === '/library' ? styles.navLinkActive : ''}`}
            >
              Public Library
            </Link>
            <Link
              href="/dashboard"
              className={`${styles.navLink} ${pathname === '/dashboard' ? styles.navLinkActive : ''}`}
            >
              Dashboard
            </Link>
            <Link
              href="/my-library"
              className={`${styles.navLink} ${pathname === '/my-library' ? styles.navLinkActive : ''}`}
            >
              My Library
            </Link>
            <Link
              href="/notes"
              className={`${styles.navLink} ${pathname === '/notes' ? styles.navLinkActive : ''}`}
            >
              Notes
            </Link>
            <Link
              href="/storage"
              className={`${styles.navLink} ${pathname === '/storage' ? styles.navLinkActive : ''}`}
            >
              Backup & Storage
            </Link>
          </nav>
        </div>

        <form className={styles.searchForm} onSubmit={handleSearch}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="search"
            placeholder="Search PDFs & OCR text..."
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

          <Link href="/admin" className={styles.adminPill} title="Admin Moderation Portal">
            <Shield size={12} />
            <span>Admin</span>
          </Link>

          <ThemeToggle />

          <Link href="/auth/login" className={styles.userBtn} title="User Account">
            <User size={17} />
          </Link>

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
