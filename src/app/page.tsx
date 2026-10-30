'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Sparkles,
  Crop,
  Code2,
  ScanSearch,
  FileEdit,
  HardDrive,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { Document } from '@/lib/types/database';
import { DocumentCard } from '@/components/library/DocumentCard';
import styles from './page.module.css';

export default function HomePage() {
  const [featuredDocs, setFeaturedDocs] = useState<Document[]>([]);

  useEffect(() => {
    let isMounted = true;
    api.documents
      .getPublic({ sort: 'popular', limit: 4 })
      .then((res) => {
        if (!isMounted) return;
        setFeaturedDocs((res.documents || []).slice(0, 4));
      })
      .catch((err) => {
        console.error('Failed to load featured documents:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main>
      {/* Hero Section */}
      <section className={styles.heroSection}>
        <div className={styles.heroGlow} />
        <div className={styles.heroBadge}>
          <Sparkles size={14} />
          <span>Next-Generation PDF Study Workspace</span>
        </div>

        <h1 className={styles.heroTitle}>
          Your Smart Library, Screenshot Reader &amp; <span className={styles.gradientText}>Study Workspace</span>
        </h1>

        <p className={styles.heroSubtitle}>
          Built for software engineers, students, and technical researchers. Experience smart crop viewing,
          code editor magnification, non-blocking page OCR, linked Tiptap study notes, and decentralized Telegram cloud backups.
        </p>

        <div className={styles.ctaGroup}>
          <Link href="/library" className={styles.primaryCta}>
            <BookOpen size={18} />
            <span>Browse Public Library</span>
          </Link>
          <Link href="/dashboard" className={styles.secondaryCta}>
            <span>Open Study Dashboard</span>
            <ArrowRight size={16} />
          </Link>
        </div>

        <div className={styles.statsBar}>
          <div className={styles.statItem}>
            <span className={styles.statValue}>100%</span>
            <span className={styles.statLabel}>Custom CSS Architecture</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>100 MB</span>
            <span className={styles.statLabel}>Strict Binary PDF Limit</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>PDF.js</span>
            <span className={styles.statLabel}>Client-Side Canvas Engine</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>Tiptap</span>
            <span className={styles.statLabel}>Page-Linked Notes</span>
          </div>
        </div>
      </section>

      {/* Featured Documents Section */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionPretitle}>Community Catalog</div>
          <h2 className={styles.sectionTitle}>Featured Curations &amp; Technical Notes</h2>
          <p className={styles.sectionDescription}>
            Verified technical PDFs and annotated lecture guides. Read immediately in browser with zero downloads.
          </p>
        </div>

        <div className={styles.docsGrid}>
          {featuredDocs.map((doc) => (
            <DocumentCard key={doc.id} document={doc} />
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
          <Link href="/library" className={styles.secondaryCta}>
            <span>View All Curated Documents</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Features Showcase */}
      <section className={styles.section} style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-subtle)' }}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionPretitle}>Core Innovations</div>
          <h2 className={styles.sectionTitle}>Engineered for Complex Technical Reading</h2>
          <p className={styles.sectionDescription}>
            Overcoming the limits of traditional PDF readers when handling code screenshots, lecture slides, and handwritten notes.
          </p>
        </div>

        <div className={styles.featureGrid}>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <Crop size={24} />
            </div>
            <h3 className={styles.featureTitle}>Smart Screenshot Crop Mode</h3>
            <p className={styles.featureText}>
              Automatically detect content boundaries or adjust margins manually to eliminate distracting whitespace, device bezels, and notification bars.
            </p>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <Code2 size={24} />
            </div>
            <h3 className={styles.featureTitle}>Code Focus Mode</h3>
            <p className={styles.featureText}>
              Select and zoom into code editors, terminal output, architectural diagrams, and small code blocks without losing overall document context.
            </p>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <ScanSearch size={24} />
            </div>
            <h3 className={styles.featureTitle}>Non-Blocking Page OCR</h3>
            <p className={styles.featureText}>
              Background OCR using Tesseract.js recognizes unselectable text from mobile screenshot PDFs and indexes words with page-coordinate navigation.
            </p>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <FileEdit size={24} />
            </div>
            <h3 className={styles.featureTitle}>Tiptap Study Notes</h3>
            <p className={styles.featureText}>
              Rich-text notes with code blocks, headings, and lists. Attach notes directly to specific pages or maintain independent notebooks.
            </p>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <HardDrive size={24} />
            </div>
            <h3 className={styles.featureTitle}>Telegram Cloud Storage</h3>
            <p className={styles.featureText}>
              Decentralized cloud backup adapter utilizing Telegram Bot API with SHA-256 cryptographic integrity verification and restore streams.
            </p>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <ShieldCheck size={24} />
            </div>
            <h3 className={styles.featureTitle}>Strict Binary Validation</h3>
            <p className={styles.featureText}>
              Server-verified %PDF- magic bytes, encryption detection, and community copyright moderation ensures a safe, clean technical catalog.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
