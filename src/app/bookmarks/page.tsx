'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { BookMarked, Trash2, ExternalLink, Bookmark as BookmarkIcon, Loader2, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api/client';
import { Bookmark } from '@/lib/types/database';
import { Sidebar } from '@/components/layout/Sidebar';

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.bookmarks.list();
      setBookmarks(res.bookmarks || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load bookmarks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleDelete = async (bookmarkId: string) => {
    try {
      await api.bookmarks.delete(bookmarkId);
      await reload();
    } catch (err: any) {
      alert(err.message || 'Failed to remove bookmark');
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - var(--header-height))', width: '100%' }}>
      <Sidebar counts={{ documents: 0, notes: 0, bookmarks: bookmarks.length }} />

      <main style={{ flex: 1, padding: '2.5rem', maxWidth: '1000px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>Saved Bookmarks</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.25rem' }}>
            Direct access to critical sections, diagram slides, and algorithm implementations.
          </p>
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
            <p>Loading bookmarks...</p>
          </div>
        ) : bookmarks.length === 0 ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', color: 'var(--text-muted)' }}>
            <BookmarkIcon size={40} style={{ margin: '0 auto 1rem', display: 'block' }} />
            <h3>No Bookmarks Saved Yet</h3>
            <p style={{ marginTop: '0.5rem' }}>While reading in the reader, click the bookmark icon or press &quot;B&quot; to bookmark any page.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {bookmarks.map((bm) => (
              <div
                key={bm.id}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--accent-primary-light)',
                      color: 'var(--accent-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <BookMarked size={18} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {bm.title || `Page ${bm.page_number}`}
                    </h2>
                    <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                      {bm.document_title || 'Document'} &bull; Page {bm.page_number}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Link
                    href={`/reader/${bm.document_id}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.45rem 0.85rem',
                      background: 'var(--accent-primary)',
                      color: '#fff',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.825rem',
                      fontWeight: 600,
                    }}
                  >
                    <span>Open Reader</span>
                    <ExternalLink size={13} />
                  </Link>

                  <button
                    type="button"
                    onClick={() => handleDelete(bm.id)}
                    style={{
                      padding: '0.45rem',
                      color: 'var(--accent-danger)',
                      background: 'transparent',
                    }}
                    title="Remove bookmark"
                  >
                    <Trash2 size={16} />
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
