import React from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Sparkles,
  Crop,
  Code2,
  ScanSearch,
  BookMarked,
  Send,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getDocuments } from '@/lib/services/documentService';
import { Document } from '@/lib/types/database';
import { DocumentCard } from '@/components/library/DocumentCard';
import styles from './page.module.css';

// Revalidate public featured catalog at the edge every 60 seconds
export const revalidate = 60;

async function getFeaturedDocuments(): Promise<Document[]> {
  try {
    const supabase = await createClient();
    if (!supabase) return [];
    const result = await getDocuments(supabase, {
      isPublic: true,
      limit: 4,
      sort: 'likes_count',
      order: 'desc',
    });
    return result.documents || [];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const featuredDocs = await getFeaturedDocuments();

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
          code editor magnification, high-performance PDF reading, bookmarks, and curated document libraries.
        </p>

        <div className={styles.ctaGroup}>
          <Link href="/library" className={styles.primaryCta}>
            <BookOpen size={18} />
            <span>Browse Public Library</span>
          </Link>
          <Link href="/dashboard" className={styles.secondaryCta}>
            <span>Open Reading Feed</span>
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
            <span className={styles.statValue}>Sync</span>
            <span className={styles.statLabel}>Reading Progress &amp; Bookmarks</span>
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
            <h3 className={styles.featureTitle}>Full-Text PDF Search</h3>
            <p className={styles.featureText}>
              High-fidelity native text selection, instant term search, and coordinate-aware page navigation powered by PDF.js.
            </p>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <BookMarked size={24} />
            </div>
            <h3 className={styles.featureTitle}>Saved Bookmarks</h3>
            <p className={styles.featureText}>
              Keep track of important pages across your reading sessions with one-click page bookmarks synchronized to your profile.
            </p>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <Send size={24} />
            </div>
            <h3 className={styles.featureTitle}>Telegram Bot Ingestion</h3>
            <p className={styles.featureText}>
              Verified publishing pipeline utilizing Telegram Bot API with SHA-256 cryptographic integrity verification and admin moderation.
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
