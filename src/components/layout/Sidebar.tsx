'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Library,
  FolderOpen,
  BookMarked,
  BarChart3,
  Send,
  Settings,
  User,
  HelpCircle,
} from 'lucide-react';
import styles from './Sidebar.module.css';

interface SidebarProps {
  counts?: {
    documents?: number;
    bookmarks?: number;
  };
}

export function Sidebar({ counts }: SidebarProps) {
  const pathname = usePathname();

  const isLinkActive = (path: string) => {
    if (path === '/dashboard') return pathname === '/dashboard';
    return pathname?.startsWith(path);
  };

  return (
    <aside className={styles.sidebar} aria-label="Workspace Sidebar">
      <div className={styles.section}>
        <span className={styles.sectionTitle}>Library</span>
        <Link
          href="/dashboard"
          className={`${styles.linkItem} ${isLinkActive('/dashboard') ? styles.linkItemActive : ''}`}
        >
          <div className={styles.iconWrapper}><LayoutDashboard size={17} /></div>
          <span>Feed</span>
        </Link>
        <Link
          href="/library"
          className={`${styles.linkItem} ${isLinkActive('/library') ? styles.linkItemActive : ''}`}
        >
          <div className={styles.iconWrapper}><Library size={17} /></div>
          <span>Public Catalog</span>
        </Link>
        <Link
          href="/my-library"
          className={`${styles.linkItem} ${isLinkActive('/my-library') ? styles.linkItemActive : ''}`}
        >
          <div className={styles.iconWrapper}><FolderOpen size={17} /></div>
          <span>My PDFs</span>
          {counts?.documents !== undefined && <span className={styles.badge}>{counts.documents}</span>}
        </Link>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionTitle}>Account &amp; System</span>
        <Link
          href="/my-contributions"
          className={`${styles.linkItem} ${isLinkActive('/my-contributions') ? styles.linkItemActive : ''}`}
        >
          <div className={styles.iconWrapper}><Send size={17} /></div>
          <span>Submissions</span>
        </Link>
        <Link
          href="/profile"
          className={`${styles.linkItem} ${isLinkActive('/profile') ? styles.linkItemActive : ''}`}
        >
          <div className={styles.iconWrapper}><User size={17} /></div>
          <span>My Profile</span>
        </Link>
        <Link
          href="/settings"
          className={`${styles.linkItem} ${isLinkActive('/settings') ? styles.linkItemActive : ''}`}
        >
          <div className={styles.iconWrapper}><Settings size={17} /></div>
          <span>Settings</span>
        </Link>
        <Link
          href="/help"
          className={`${styles.linkItem} ${isLinkActive('/help') ? styles.linkItemActive : ''}`}
        >
          <div className={styles.iconWrapper}><HelpCircle size={17} /></div>
          <span>Help &amp; Guide</span>
        </Link>
      </div>
    </aside>
  );
}
