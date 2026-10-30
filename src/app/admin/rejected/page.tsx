'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  XCircle,
  Eye,
  RotateCcw,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { TelegramUpload } from '@/lib/types/database';

export default function AdminRejectedUploadsPage() {
  const [uploads, setUploads] = useState<TelegramUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchRejected = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/admin/uploads?status=rejected')
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const data = await res.json();
        setUploads(data.data?.uploads || []);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load rejected uploads');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchRejected();
  }, [fetchRejected]);

  const handleReopen = async (upload: TelegramUpload) => {
    try {
      const res = await fetch(`/api/admin/uploads/${upload.id}/reopen`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error?.message || 'Reopen failed');

      setSuccess(`Upload "${upload.title}" reopened for review.`);
      setTimeout(() => setSuccess(null), 3000);
      fetchRejected();
    } catch (err: any) {
      setError(err.message || 'Error reopening upload');
    }
  };

  return (
    <AdminLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Rejected Telegram Uploads
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', marginTop: '0.35rem' }}>
            Audit reasons for rejected PDFs, preview original files, or reopen submissions for reconsideration.
          </p>
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
              <p>Loading rejected uploads...</p>
            </div>
          ) : uploads.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <XCircle size={40} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
              <p>No rejected uploads recorded.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-medium)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                    <th style={{ padding: '0.85rem 1rem' }}>Title / Original File</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Rejection Reason</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Reviewed By</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {uploads.map((upload) => (
                    <tr key={upload.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{upload.title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {(upload.file_size / (1024 * 1024)).toFixed(2)} MB • {upload.original_filename}
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#ef4444', maxWidth: '320px' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                          {upload.rejection_reason || 'No specific reason provided'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {upload.reviewed_at ? new Date(upload.reviewed_at).toLocaleDateString() : 'N/A'}
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                        {upload.reviewed_by || 'Administrator'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                          <a
                            href={`/api/admin/uploads/${upload.id}/file`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              padding: '0.35rem 0.65rem',
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
                            <span>Preview</span>
                          </a>

                          <button
                            type="button"
                            onClick={() => handleReopen(upload)}
                            style={{
                              padding: '0.35rem 0.65rem',
                              background: 'rgba(59, 130, 246, 0.1)',
                              border: '1px solid rgba(59, 130, 246, 0.25)',
                              color: '#3b82f6',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                          >
                            <RotateCcw size={12} />
                            <span>Reopen</span>
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
