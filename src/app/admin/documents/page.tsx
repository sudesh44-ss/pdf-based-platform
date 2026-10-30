'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Files,
  Search,
  Filter,
  Eye,
  Trash2,
  FileMinus,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Document } from '@/lib/types/database';

export default function AdminAllDocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchDocs = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (search.trim()) params.set('q', search.trim());

    fetch(`/api/admin/documents?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const data = await res.json();
        setDocuments(data.data?.documents || []);
      })
      .catch((err) => {
        setError(err.message || 'Failed to fetch documents');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [statusFilter, search]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const handleUnpublish = async (doc: Document) => {
    if (!confirm(`Unpublish "${doc.title}"? It will immediately disappear from the public library.`)) return;

    try {
      const res = await fetch(`/api/admin/documents/${doc.id}/unpublish`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error?.message || 'Unpublish failed');

      setSuccess(`"${doc.title}" unpublished successfully.`);
      setTimeout(() => setSuccess(null), 3000);
      fetchDocs();
    } catch (err: any) {
      setError(err.message || 'Error unpublishing document');
    }
  };

  const handleDelete = async (doc: Document) => {
    if (!confirm(`Delete "${doc.title}"?`)) return;

    try {
      const res = await fetch(`/api/admin/documents/${doc.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error?.message || 'Delete failed');

      setSuccess(`"${doc.title}" removed.`);
      setTimeout(() => setSuccess(null), 3000);
      fetchDocs();
    } catch (err: any) {
      setError(err.message || 'Error deleting document');
    }
  };

  return (
    <AdminLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Master Documents Directory
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', marginTop: '0.35rem' }}>
            Comprehensive catalog of all public, draft, and moderated PDF documents in PostgreSQL.
          </p>
        </div>

        {/* Filters */}
        <div
          style={{
            display: 'flex',
            gap: '1rem',
            alignItems: 'center',
            flexWrap: 'wrap',
            background: 'var(--bg-secondary)',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-medium)',
          }}
        >
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="search"
              placeholder="Search documents by title or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem 0.55rem 2.25rem',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Filter size={16} style={{ color: 'var(--text-muted)' }} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '0.55rem 0.85rem',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
              }}
            >
              <option value="all">All Document Statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft / Unpublished</option>
              <option value="pending_review">Pending Review</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.85rem 1.25rem', borderRadius: 'var(--radius-md)', background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.85rem 1.25rem', borderRadius: 'var(--radius-md)', background: 'rgba(34, 197, 94, 0.12)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.25)' }}>
            <CheckCircle2 size={18} />
            <span>{success}</span>
          </div>
        )}

        {/* Table */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Loader2 className="animate-spin" size={26} style={{ margin: '0 auto 0.5rem' }} />
              <p>Loading documents...</p>
            </div>
          ) : documents.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Files size={40} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
              <p>No documents found matching the selected criteria.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-medium)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                    <th style={{ padding: '0.85rem 1rem' }}>Title &amp; Category</th>
                    <th style={{ padding: '0.85rem 1rem' }}>File Size</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Storage</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Status</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{doc.title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {doc.categories?.[0] || 'General'} • {doc.page_count} pages
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                        {(doc.file_size / (1024 * 1024)).toFixed(2)} MB
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {doc.storage_type} ({doc.storage_file_id ? 'Linked' : 'None'})
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span
                          style={{
                            padding: '0.2rem 0.55rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            background:
                              doc.status === 'published'
                                ? 'rgba(34, 197, 94, 0.12)'
                                : 'var(--bg-tertiary)',
                            color:
                              doc.status === 'published'
                                ? '#22c55e'
                                : 'var(--text-secondary)',
                          }}
                        >
                          {doc.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                          <Link
                            href={`/reader/${doc.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              padding: '0.35rem 0.6rem',
                              background: 'var(--bg-tertiary)',
                              color: 'var(--text-primary)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                          >
                            <Eye size={12} />
                            <span>Reader</span>
                          </Link>

                          {doc.status === 'published' && (
                            <button
                              type="button"
                              onClick={() => handleUnpublish(doc)}
                              style={{
                                padding: '0.35rem 0.6rem',
                                background: 'rgba(245, 158, 11, 0.1)',
                                border: '1px solid rgba(245, 158, 11, 0.25)',
                                color: '#f59e0b',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                              }}
                            >
                              <FileMinus size={12} />
                              <span>Unpublish</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDelete(doc)}
                            style={{
                              padding: '0.35rem 0.6rem',
                              background: 'rgba(239, 68, 68, 0.08)',
                              border: '1px solid rgba(239, 68, 68, 0.2)',
                              color: '#ef4444',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                          >
                            <Trash2 size={12} />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
