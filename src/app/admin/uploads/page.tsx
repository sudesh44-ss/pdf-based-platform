'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  UploadCloud,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  Search,
  ExternalLink,
  Eye,
  Loader2,
  AlertCircle,
  Filter,
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { TelegramUpload, TelegramUploadStatus } from '@/lib/types/database';

export default function TelegramUploadsPage() {
  const [uploads, setUploads] = useState<TelegramUpload[]>([]);
  const [statusFilter, setStatusFilter] = useState<TelegramUploadStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUploads = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (search.trim()) params.set('q', search.trim());

    fetch(`/api/admin/uploads?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const data = await res.json();
        setUploads(data.data?.uploads || []);
      })
      .catch((err) => {
        setError(err.message || 'Failed to retrieve uploads');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [statusFilter, search]);

  useEffect(() => {
    fetchUploads();
  }, [fetchUploads]);

  const formatFileSize = (bytes: number) => {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatTimestamp = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <AdminLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Telegram PDF Ingestion Queue
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', marginTop: '0.35rem' }}>
              All PDF files ingested through authorized Telegram channels and direct bot webhooks.
            </p>
          </div>

          <Link
            href="/admin/pending"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.65rem 1.15rem',
              background: 'var(--accent-primary)',
              color: '#fff',
              borderRadius: 'var(--radius-md)',
              fontWeight: 600,
              fontSize: '0.875rem',
              textDecoration: 'none',
            }}
          >
            <Clock size={16} />
            <span>Go to Review Queue</span>
          </Link>
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
              placeholder="Filter by title or filename..."
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
              onChange={(e) => setStatusFilter(e.target.value as any)}
              style={{
                padding: '0.55rem 0.85rem',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
              }}
            >
              <option value="all">All Ingestion States</option>
              <option value="pending">Pending Review</option>
              <option value="under_review">Under Review</option>
              <option value="approved">Approved</option>
              <option value="published">Published</option>
              <option value="rejected">Rejected</option>
              <option value="processing_failed">Processing Failed</option>
            </select>
          </div>
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius-md)', color: '#ef4444' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Uploads Table */}
        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}
        >
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Loader2 className="animate-spin" size={26} style={{ margin: '0 auto 0.5rem' }} />
              <p>Loading Telegram uploads...</p>
            </div>
          ) : uploads.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <UploadCloud size={40} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
              <p style={{ fontSize: '1rem', fontWeight: 600 }}>No Telegram uploads found</p>
              <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                Files sent to your Telegram bot or channel will appear here in real time.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-medium)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                    <th style={{ padding: '0.85rem 1rem' }}>PDF Title / File</th>
                    <th style={{ padding: '0.85rem 1rem' }}>File Size</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Telegram Source</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Ingested Date</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Status</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {uploads.map((upload) => (
                    <tr key={upload.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{upload.title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{upload.original_filename}</div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                        {formatFileSize(upload.file_size)}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                        <div>{upload.metadata?.source_chat_title || 'Telegram Channel'}</div>
                        <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Chat ID: {upload.telegram_chat_id}</div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)' }}>
                        {formatTimestamp(upload.uploaded_at)}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span
                          style={{
                            padding: '0.25rem 0.55rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            background:
                              upload.status === 'published'
                                ? 'rgba(34, 197, 94, 0.12)'
                                : upload.status === 'pending'
                                ? 'rgba(245, 158, 11, 0.12)'
                                : upload.status === 'rejected'
                                ? 'rgba(239, 68, 68, 0.12)'
                                : 'var(--bg-tertiary)',
                            color:
                              upload.status === 'published'
                                ? '#22c55e'
                                : upload.status === 'pending'
                                ? '#f59e0b'
                                : upload.status === 'rejected'
                                ? '#ef4444'
                                : 'var(--text-secondary)',
                          }}
                        >
                          {upload.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
                          <a
                            href={`/api/admin/uploads/${upload.id}/file`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.35rem 0.65rem',
                              borderRadius: 'var(--radius-sm)',
                              background: 'var(--bg-tertiary)',
                              color: 'var(--text-primary)',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              textDecoration: 'none',
                            }}
                          >
                            <Eye size={12} />
                            <span>Preview</span>
                          </a>

                          <Link
                            href={`/admin/pending?id=${upload.id}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.35rem 0.65rem',
                              borderRadius: 'var(--radius-sm)',
                              background: 'var(--accent-primary)',
                              color: '#fff',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              textDecoration: 'none',
                            }}
                          >
                            <span>Review</span>
                          </Link>
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
