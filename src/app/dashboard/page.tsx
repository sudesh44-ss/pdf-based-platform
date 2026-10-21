'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  FolderOpen,
  FileText,
  BookMarked,
  Clock,
  ArrowRight,
  TrendingUp,
  HardDrive,
  UploadCloud,
} from 'lucide-react';
import { storageEngine } from '@/lib/store/storageEngine';
import { Document, ReadingProgress, Note, Bookmark } from '@/lib/types/database';
import { Sidebar } from '@/components/layout/Sidebar';
import styles from './page.module.css';

export default function DashboardPage() {
  const [recentProgress, setRecentProgress] = useState<{ progress: ReadingProgress; doc: Document }[]>([]);
  const [recentNotes, setRecentNotes] = useState<Note[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [counts, setCounts] = useState({ documents: 0, notes: 0, bookmarks: 0 });

  useEffect(() => {
    const allProgress = storageEngine.getAllReadingProgress();
    const docs = storageEngine.getDocuments();
    const notes = storageEngine.getNotes();
    const bms = storageEngine.getBookmarks();

    const matched = allProgress
      .map((p) => {
        const doc = docs.find((d) => d.id === p.document_id);
        return doc ? { progress: p, doc } : null;
      })
      .filter(Boolean) as { progress: ReadingProgress; doc: Document }[];

    setRecentProgress(matched.slice(0, 3));
    setRecentNotes(notes.slice(0, 4));
    setBookmarks(bms.slice(0, 4));
    setCounts({
      documents: docs.filter((d) => !d.is_trash).length,
      notes: notes.length,
      bookmarks: bms.length,
    });
  }, []);

  const formatActiveTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m active read time`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m active read time`;
  };

  return (
    <div className={styles.container}>
      <Sidebar counts={counts} />

      <main className={styles.mainContent}>
        <div className={styles.welcomeRow}>
          <div>
            <h1 className={styles.welcomeTitle}>Personal Study Dashboard</h1>
            <p className={styles.welcomeSubtitle}>
              Pick up where you left off, review page annotations, and synchronize Telegram cloud backups.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Link
              href="/my-library"
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
              }}
            >
              <UploadCloud size={15} />
              <span>Upload PDF</span>
            </Link>
          </div>
        </div>

        {/* Quick Stats */}
        <div className={styles.quickStatsRow}>
          <div className={styles.statCard}>
            <div className={styles.statIcon}><FolderOpen size={22} /></div>
            <div>
              <div className={styles.statNumber}>{counts.documents}</div>
              <div className={styles.statName}>Library Documents</div>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}><FileText size={22} /></div>
            <div>
              <div className={styles.statNumber}>{counts.notes}</div>
              <div className={styles.statName}>Study Notes</div>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}><BookMarked size={22} /></div>
            <div>
              <div className={styles.statNumber}>{counts.bookmarks}</div>
              <div className={styles.statName}>Saved Bookmarks</div>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}><HardDrive size={22} /></div>
            <div>
              <div className={styles.statNumber}>100%</div>
              <div className={styles.statName}>Telegram Cloud Synchronized</div>
            </div>
          </div>
        </div>

        {/* Continue Reading */}
        <section>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Continue Reading</h2>
            <Link href="/library" className={styles.sectionLink}>Browse All</Link>
          </div>

          {recentProgress.length === 0 ? (
            <div style={{ padding: '2rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No reading history recorded yet. Open a document from the <Link href="/library" style={{ color: 'var(--accent-primary)' }}>library</Link> to start!
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

        {/* Recent Study Notes */}
        <section>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Recent Study Notes</h2>
            <Link href="/notes" className={styles.sectionLink}>View All Notes</Link>
          </div>

          <div className={styles.notesList}>
            {recentNotes.map((note) => (
              <Link key={note.id} href="/notes" className={styles.noteItem}>
                <h3 className={styles.noteTitle}>{note.title}</h3>
                <p className={styles.noteSnippet}>
                  {note.content_html.replace(/<[^>]+>/g, ' ') || 'No content yet...'}
                </p>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 'auto' }}>
                  {note.document_title ? `Linked to ${note.document_title}` : 'Independent Note'}
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
