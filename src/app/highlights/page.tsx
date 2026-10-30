'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Highlighter, ExternalLink, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api/client';
import { Annotation, Document } from '@/lib/types/database';
import { Sidebar } from '@/components/layout/Sidebar';

export default function HighlightsPage() {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reloadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const docsRes = await api.documents.getMine({ limit: 50 });
      const docs = docsRes.documents || [];
      setDocuments(docs);

      const allAnns: Annotation[] = [];
      const targets = selectedDocId === 'all' ? docs : docs.filter((d) => d.id === selectedDocId);

      await Promise.all(
        targets.map(async (doc) => {
          try {
            const annRes = await api.annotations.list(doc.id);
            allAnns.push(...(annRes.annotations || []));
          } catch {
            // Ignore per-doc error
          }
        })
      );

      setAnnotations(allAnns);
    } catch (err: any) {
      setError(err.message || 'Failed to load annotations');
    } finally {
      setLoading(false);
    }
  }, [selectedDocId]);

  useEffect(() => {
    reloadData();
  }, [reloadData]);

  const handleDelete = async (id: string) => {
    try {
      await api.annotations.delete(id);
      setAnnotations((prev) => prev.filter((a) => a.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete annotation');
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - var(--header-height))', width: '100%' }}>
      <Sidebar />

      <main style={{ flex: 1, padding: '2.5rem', maxWidth: '1000px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>Highlights &amp; Annotations</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.25rem' }}>
              All text highlights, code block callouts, and notes across your technical PDFs.
            </p>
          </div>

          {documents.length > 0 && (
            <select
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
              style={{
                padding: '0.5rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-medium)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
              aria-label="Filter highlights by document"
            >
              <option value="all">All Documents ({documents.length})</option>
              {documents.map((d) => (
                <option key={d.id} value={d.id}>{d.title}</option>
              ))}
            </select>
          )}
        </div>

        {error && (
          <div style={{ padding: '0.85rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader2 size={28} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
            <p>Loading highlights...</p>
          </div>
        ) : annotations.length === 0 ? (
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

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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

                  <button
                    type="button"
                    onClick={() => handleDelete(ann.id)}
                    style={{
                      padding: '0.4rem',
                      color: 'var(--accent-danger)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                    title="Delete highlight"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
