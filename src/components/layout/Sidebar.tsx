'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Library,
  FolderOpen,
  FileText,
  BookMarked,
  Highlighter,
  BarChart3,
  HardDrive,
  UploadCloud,
  Settings,
  User,
  HelpCircle,
} from 'lucide-react';
import styles from './Sidebar.module.css';

interface SidebarProps {
  counts?: {
    documents?: number;
    notes?: number;
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
        <span className={styles.sectionTitle}>Main Library</span>
        <Link
          href="/dashboard"
          className={`${styles.linkItem} ${isLinkActive('/dashboard') ? styles.linkItemActive : ''}`}
        >
          <div className={styles.iconWrapper}><LayoutDashboard size={17} /></div>
          <span>Dashboard</span>
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
        <span className={styles.sectionTitle}>Study Workspace</span>
        <Link
          href="/notes"
          className={`${styles.linkItem} ${isLinkActive('/notes') ? styles.linkItemActive : ''}`}
        >
          <div className={styles.iconWrapper}><FileText size={17} /></div>
          <span>Study Notes</span>
          {counts?.notes !== undefined && <span className={styles.badge}>{counts.notes}</span>}
        </Link>
        <Link
          href="/notebooks"
          className={`${styles.linkItem} ${isLinkActive('/notebooks') ? styles.linkItemActive : ''}`}
        >
          <div className={styles.iconWrapper}><BookMarked size={17} /></div>
          <span>Notebooks</span>
        </Link>
        <Link
          href="/bookmarks"
          className={`${styles.linkItem} ${isLinkActive('/bookmarks') ? styles.linkItemActive : ''}`}
        >
          <div className={styles.iconWrapper}><BookMarked size={17} /></div>
          <span>Bookmarks</span>
          {counts?.bookmarks !== undefined && <span className={styles.badge}>{counts.bookmarks}</span>}
        </Link>
        <Link
          href="/highlights"
          className={`${styles.linkItem} ${isLinkActive('/highlights') ? styles.linkItemActive : ''}`}
        >
          <div className={styles.iconWrapper}><Highlighter size={17} /></div>
          <span>Highlights</span>
        </Link>
        <Link
          href="/statistics"
          className={`${styles.linkItem} ${isLinkActive('/statistics') ? styles.linkItemActive : ''}`}
        >
          <div className={styles.iconWrapper}><BarChart3 size={17} /></div>
          <span>Reading Stats</span>
        </Link>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionTitle}>Cloud & System</span>
        <Link
          href="/storage"
          className={`${styles.linkItem} ${isLinkActive('/storage') ? styles.linkItemActive : ''}`}
        >
          <div className={styles.iconWrapper}><HardDrive size={17} /></div>
          <span>Telegram Backup</span>
        </Link>
        <Link
          href="/my-contributions"
          className={`${styles.linkItem} ${isLinkActive('/my-contributions') ? styles.linkItemActive : ''}`}
        >
          <div className={styles.iconWrapper}><UploadCloud size={17} /></div>
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
          <span>Help & Guide</span>
        </Link>
      </div>

      <div className={styles.storageCard}>
        <div className={styles.storageTitle}>
          <span>Telegram Storage</span>
          <span>16.4 MB</span>
        </div>
        <div className={styles.storageProgressBg}>
          <div className={styles.storageProgressBar} style={{ width: '16%' }} />
        </div>
        <span className={styles.storageSubtext}>Encrypted Telegram Cloud Active</span>
      </div>
    </aside>
  );
}
