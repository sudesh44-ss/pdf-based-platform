'use client';

import React, { useEffect, useState } from 'react';
import { BarChart3, Clock, BookOpen, Layers, CheckCircle2, TrendingUp, Info } from 'lucide-react';
import { api } from '@/lib/api/client';
import { ReadingProgress, Document } from '@/lib/types/database';
import { Sidebar } from '@/components/layout/Sidebar';

export default function StatisticsPage() {
  const [progressList, setProgressList] = useState<{ progress: ReadingProgress; doc: Document }[]>([]);
  const [totalActiveSeconds, setTotalActiveSeconds] = useState(0);
  const [totalPagesRead, setTotalPagesRead] = useState(0);

  useEffect(() => {
    let isMounted = true;
    api.readingProgress.list().then((res) => {
      if (!isMounted) return;
      let secs = 0;
      let pages = 0;

      const matched = (res.progressList || [])
        .map((p) => {
          if (p.document) {
            secs += p.progress.active_seconds || 0;
            pages += p.progress.current_page || 0;
            return { progress: p.progress, doc: p.document };
          }
          return null;
        })
        .filter(Boolean) as { progress: ReadingProgress; doc: Document }[];

      setProgressList(matched);
      setTotalActiveSeconds(secs);
      setTotalPagesRead(pages);
    }).catch((err) => {
      console.error('Error loading reading statistics:', err);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const formatActiveTime = (totalSecs: number) => {
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m ${secs}s`;
    }
    return `${mins}m ${secs}s`;
  };

  // Estimated reading time at standard technical rate: 2.5 minutes per technical page
  const estimatedSeconds = totalPagesRead * 150;

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - var(--header-height))', width: '100%' }}>
      <Sidebar />

      <main style={{ flex: 1, padding: '2.5rem', maxWidth: '1100px', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>Reading Activity &amp; Analytics</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.25rem' }}>
            Empirical reading telemetry: distinguish active viewport engagement from estimated document completion time.
          </p>
        </div>

        {/* Big metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Clock size={14} color="var(--accent-primary)" />
              Directly Measured Active Time
            </span>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
              {formatActiveTime(totalActiveSeconds)}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Window focused &amp; verified reader events
            </span>
          </div>

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <TrendingUp size={14} color="var(--accent-secondary)" />
              Estimated Comprehension Time
            </span>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>
              {formatActiveTime(estimatedSeconds)}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Approx. 2.5 min / technical page pace
            </span>
          </div>

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Layers size={14} color="var(--accent-success)" />
              Total Pages Completed
            </span>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-success)' }}>
              {totalPagesRead} pages
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Across {progressList.length} distinct documents
            </span>
          </div>
        </div>

        {/* Methodology Notice */}
        <div
          style={{
            padding: '1rem 1.25rem',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
          }}
        >
          <Info size={18} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--text-primary)' }}>Integrity in Reading Telemetry:</strong> Directly measured active time is calculated exclusively when the PDF reader window is focused and active page interactions are occurring. It is strictly distinguished from theoretical reading time.
          </div>
        </div>

        {/* Per-Document Breakdown */}
        <section>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>Document Progress Breakdown</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {progressList.map(({ progress, doc }) => (
              <div
                key={progress.id}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: 1, minWidth: '240px' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{doc.title}</h3>
                  <div style={{ width: '100%', height: '6px', background: 'var(--bg-tertiary)', borderRadius: '9999px', marginTop: '0.5rem', overflow: 'hidden' }}>
                    <div style={{ width: `${progress.percentage}%`, height: '100%', background: 'var(--accent-primary)' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Page: </span>
                    <strong style={{ color: 'var(--text-primary)' }}>{progress.current_page} / {progress.total_pages}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Active: </span>
                    <strong style={{ color: 'var(--text-primary)' }}>{formatActiveTime(progress.active_seconds)}</strong>
                  </div>
                  <div style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>
                    {progress.percentage}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
