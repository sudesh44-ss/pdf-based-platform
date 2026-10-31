'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  FolderOpen,
  BookMarked,
  Clock,
  ArrowRight,
  Sparkles,
  Loader2,
  AlertCircle,
  Tag,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { Document, ReadingProgress } from '@/lib/types/database';
import { Sidebar } from '@/components/layout/Sidebar';
import styles from './page.module.css';

export default function DashboardPage() {
  const [recentProgress, setRecentProgress] = useState<{ progress: ReadingProgress; doc: Document }[]>([]);
  const [recentPublished, setRecentPublished] = useState<Document[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [counts, setCounts] = useState({ documents: 0, bookmarks: 0, activeMinutes: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardData() {
      setLoading(true);
      setError(null);
      try {
        const [progressRes, myDocsRes, publicDocsRes, bookmarksRes] = await Promise.allSettled([
          api.readingProgress.list(),
          api.documents.getMine({ limit: 1 }),
          api.documents.getPublic({ limit: 6, sort: 'created_at', order: 'desc' }),
          api.bookmarks.list(),
        ]);

        if (!isMounted) return;

        let totalActiveSeconds = 0;
        if (progressRes.status === 'fulfilled') {
          const matched = progressRes.value.progressList
            .map((item) => {
              if (item.progress.active_seconds) {
                totalActiveSeconds += item.progress.active_seconds;
              }
              return item.document ? { progress: item.progress, doc: item.document } : null;
            })
            .filter(Boolean) as { progress: ReadingProgress; doc: Document }[];
          setRecentProgress(matched.slice(0, 3));
        }

        if (publicDocsRes.status === 'fulfilled') {
          const pubDocs = (publicDocsRes.value.documents || []).filter(
            (d: Document) => d.status === 'published' && d.is_public
          );
          setRecentPublished(pubDocs.slice(0, 4));

          // Extract unique categories
          const catsSet = new Set<string>();
          pubDocs.forEach((d: Document) => d.categories?.forEach((c: string) => catsSet.add(c)));
          setCategories(Array.from(catsSet).slice(0, 6));
        }

        const docCount = myDocsRes.status === 'fulfilled' ? myDocsRes.value.total : 0;
        const bmCount = bookmarksRes.status === 'fulfilled' ? bookmarksRes.value.total : 0;

        setCounts({
          documents: docCount,
          bookmarks: bmCount,
          activeMinutes: Math.floor(totalActiveSeconds / 60),
        });
      } catch (err: any) {
        if (!isMounted) return;
        setError(err.message || 'Failed to load feed data');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadDashboardData();

    return () => {
      isMounted = false;
    };
  }, []);

  const formatActiveTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m active reading`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m active reading`;
  };

  return (
    <div className={styles.container}>
      <Sidebar counts={counts} />

      <main className={styles.mainContent}>
        <div className={styles.welcomeRow}>
          <div>
            <h1 className={styles.welcomeTitle}>Your Reading Feed</h1>
            <p className={styles.welcomeSubtitle}>
              Pick up where you left off, explore recently published materials, and discover documents.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Link
              href="/library"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.55rem 1rem',
                background: 'var(--accent-primary)',
                color: '#fff',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.875rem',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              <BookOpen size={15} />
              <span>Explore Library</span>
            </Link>
          </div>
        </div>

        {error && (
          <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Quick Stats */}
        <div className={styles.quickStatsRow}>
          <div className={styles.statCard}>
            <div className={styles.statIcon}><FolderOpen size={22} /></div>
            <div>
              <div className={styles.statNumber}>{loading ? '...' : counts.documents}</div>
              <div className={styles.statName}>Library Documents</div>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}><BookMarked size={22} /></div>
            <div>
              <div className={styles.statNumber}>{loading ? '...' : counts.bookmarks}</div>
              <div className={styles.statName}>Saved Bookmarks</div>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}><Clock size={22} /></div>
            <div>
              <div className={styles.statNumber}>{loading ? '...' : `${counts.activeMinutes}m`}</div>
              <div className={styles.statName}>Active Reading Time</div>
            </div>
          </div>
        </div>

        {/* Continue Reading */}
        <section>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Continue Reading</h2>
            <Link href="/my-library" className={styles.sectionLink}>View My Library</Link>
          </div>

          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
              <p>Loading reading progress...</p>
            </div>
          ) : recentProgress.length === 0 ? (
            <div style={{ padding: '2rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No reading history recorded yet. Open an approved document from the <Link href="/library" style={{ color: 'var(--accent-primary)' }}>public catalog</Link> to start!
            </div>
          ) : (
            <div className={styles.continueGrid}>
              {recentProgress.map(({ progress, doc }) => (
                <div key={progress.id} className={styles.continueCard}>
                  <h3 className={styles.continueTitle}>{doc.title}</h3>
                  <div className={styles.progressTrack}>
                    <div className={styles.progressBar} style={{ width: `${progress.percentage}%` }} />
                  </div>
                  <div className={styles.continueFooter}>
                    <span>Page {progress.current_page} of {progress.total_pages} ({progress.percentage}%)</span>
                    <Link href={`/reader/${doc.id}`} className={styles.resumeBtn}>
                      <BookOpen size={13} />
                      <span>Resume</span>
                    </Link>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {formatActiveTime(progress.active_seconds)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recently Published PDFs */}
        <section>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              <Sparkles size={18} style={{ color: 'var(--accent-primary)', display: 'inline', marginRight: '0.4rem' }} />
              Recently Published PDFs
            </h2>
            <Link href="/library" className={styles.sectionLink}>Browse All</Link>
          </div>

          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
            </div>
          ) : recentPublished.length === 0 ? (
            <div style={{ padding: '2rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No published PDFs available yet. Check back soon!
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: '1rem',
              }}
            >
              {recentPublished.map((doc) => (
                <div
                  key={doc.id}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                  }}
                >
                  <div>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '0.2rem 0.5rem',
                        background: 'rgba(59, 130, 246, 0.1)',
                        color: 'var(--accent-primary)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        borderRadius: 'var(--radius-sm)',
                        marginBottom: '0.5rem',
                      }}
                    >
                      {doc.categories?.[0] || 'General'}
                    </span>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.35rem 0' }}>
                      {doc.title}
                    </h3>
                    <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: 0, lineClamp: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {doc.description || 'Verified academic study guide.'}
                    </p>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid var(--border-light)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {doc.page_count} pages
                    </span>
                    <Link
                      href={`/reader/${doc.id}`}
                      style={{
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: 'var(--accent-primary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        textDecoration: 'none',
                      }}
                    >
                      Read <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Categories Explorer */}
        {categories.length > 0 && (
          <section>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Browse by Discipline</h2>
              <Link href="/library" className={styles.sectionLink}>All Categories</Link>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {categories.map((cat) => (
                <Link
                  key={cat}
                  href={`/library?category=${encodeURIComponent(cat)}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.45rem 0.85rem',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    textDecoration: 'none',
                  }}
                >
                  <Tag size={13} style={{ color: 'var(--accent-primary)' }} />
                  <span>{cat}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
