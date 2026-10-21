'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, ShieldCheck, Database } from 'lucide-react';
import styles from './Footer.module.css';

export function Footer() {
  const pathname = usePathname();
  const isReader = pathname?.startsWith('/reader/');

  if (isReader) return null;

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brandCol}>
          <div className={styles.brandName}>
            <BookOpen size={20} color="var(--accent-primary)" />
            <span>SmartPDF Workspace</span>
          </div>
          <p className={styles.tagline}>
            Next-generation personal digital library, screenshot reader, smart cropping, and study workspace.
          </p>
          <div className={styles.storageBadge}>
            <Database size={13} />
            <span>Telegram Bot Storage & Supabase Verified</span>
          </div>
        </div>

        <div>
          <h4 className={styles.colTitle}>Library & Workspace</h4>
          <ul className={styles.linkList}>
            <li><Link href="/library" className={styles.footerLink}>Public Library</Link></li>
            <li><Link href="/dashboard" className={styles.footerLink}>Personal Dashboard</Link></li>
            <li><Link href="/my-library" className={styles.footerLink}>My Documents</Link></li>
            <li><Link href="/notes" className={styles.footerLink}>Study Notes</Link></li>
            <li><Link href="/notebooks" className={styles.footerLink}>Notebooks</Link></li>
            <li><Link href="/search" className={styles.footerLink}>OCR Full-Text Search</Link></li>
          </ul>
        </div>

        <div>
          <h4 className={styles.colTitle}>Features & Operations</h4>
          <ul className={styles.linkList}>
            <li><Link href="/my-contributions" className={styles.footerLink}>Submit PDF</Link></li>
            <li><Link href="/storage" className={styles.footerLink}>Telegram Cloud Backup</Link></li>
            <li><Link href="/statistics" className={styles.footerLink}>Reading Analytics</Link></li>
            <li><Link href="/settings" className={styles.footerLink}>Reader Preferences</Link></li>
            <li><Link href="/admin" className={styles.footerLink}>Admin Moderation</Link></li>
          </ul>
        </div>

        <div>
          <h4 className={styles.colTitle}>Documentation & Legal</h4>
          <ul className={styles.linkList}>
            <li><Link href="/help" className={styles.footerLink}>Help & Guides</Link></li>
            <li><Link href="/privacy" className={styles.footerLink}>Privacy Policy</Link></li>
            <li><Link href="/terms" className={styles.footerLink}>Terms & Conditions</Link></li>
            <li><Link href="/copyright" className={styles.footerLink}>Copyright & DMCA</Link></li>
            <li><Link href="/contact" className={styles.footerLink}>Support Contact</Link></li>
          </ul>
        </div>
      </div>

      <div className={styles.bottomBar}>
        <p>© 2026 SmartPDF. Non-blocking OCR, Custom CSS design, and encrypted cloud backups.</p>
        <p>Built with Next.js App Router, React 19 & PDF.js</p>
      </div>
    </footer>
  );
}
