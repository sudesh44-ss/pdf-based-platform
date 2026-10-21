'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Highlighter, ExternalLink, Trash2 } from 'lucide-react';
import { storageEngine } from '@/lib/store/storageEngine';
import { Annotation } from '@/lib/types/database';
import { Sidebar } from '@/components/layout/Sidebar';

export default function HighlightsPage() {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  useEffect(() => {
    // Collect annotations from sample documents
    const doc1Anns = storageEngine.getAnnotations('doc-dist-sys-01');
    const doc2Anns = storageEngine.getAnnotations('doc-react-ts-02');
    setAnnotations([...doc1Anns, ...doc2Anns]);
  }, []);

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - var(--header-height))', width: '100%' }}>
      <Sidebar />

      <main style={{ flex: 1, padding: '2.5rem', maxWidth: '1000px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>Highlights &amp; Annotations</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.25rem' }}>
            All text highlights, code block callouts, and notes across your technical PDFs.
          </p>
        </div>

        {annotations.length === 0 ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', color: 'var(--text-muted)' }}>
            <Highlighter size={40} style={{ margin: '0 auto 1rem', display: 'block' }} />
            <h3>No Highlights Recorded Yet</h3>
            <p style={{ marginTop: '0.5rem' }}>Open any document in the reader to highlight important sections.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {annotations.map((ann) => (
              <div
                key={ann.id}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  borderLeft: `4px solid ${ann.color}`,
                }}
              >
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    Page {ann.page_number} &bull; {ann.type.toUpperCase()}
                  </div>
                  <p style={{ fontSize: '0.95rem', color: 'var(--text-primary)', fontStyle: 'italic' }}>
                    &ldquo;{ann.content || 'Highlighted region'}&rdquo;
                  </p>
                </div>

                <Link
                  href={`/reader/${ann.document_id}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.4rem 0.75rem',
                    background: 'var(--accent-primary)',
                    color: '#fff',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  <span>View</span>
                  <ExternalLink size={12} />
                </Link>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
