'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Loader2,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  Clock,
  User,
  Search,
  CheckCircle2,
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';

interface UserActivityRecord {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string | null;
  document_id: string;
  document_title: string;
  current_page: number;
  total_pages: number;
  percentage: number;
  active_seconds: number;
  last_read_at: string;
}

export default function AdminUserActivityPage() {
  const [activity, setActivity] = useState<UserActivityRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchActivity = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/admin/user-activity?limit=50')
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setActivity(data.data?.activity || []);
        setTotal(data.data?.total || 0);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load user activity');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  const formatSeconds = (sec: number) => {
    if (!sec || sec < 60) return `${sec || 0}s`;
    const mins = Math.floor(sec / 60);
    const hours = Math.floor(mins / 60);
    if (hours > 0) return `${hours}h ${mins % 60}m`;
    return `${mins}m`;
  };

  const filtered = activity.filter((item) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      item.document_title.toLowerCase().includes(term) ||
      item.user_email.toLowerCase().includes(term) ||
      (item.user_name && item.user_name.toLowerCase().includes(term))
    );
  });

  return (
    <AdminLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        {/* Page Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1
              style={{
                fontSize: '1.85rem',
                fontWeight: 800,
                color: 'var(--text-primary)',
                margin: 0,
              }}
            >
              User Reading Activity
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', marginTop: '0.35rem' }}>
              Synchronized reading progress, page positions, and reading session durations.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchActivity}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.55rem 0.95rem',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Privacy Guarantee Banner */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
            padding: '1rem 1.25rem',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: 'var(--radius-lg)',
            color: '#10b981',
          }}
        >
          <ShieldCheck size={24} style={{ flexShrink: 0 }} />
          <div style={{ fontSize: '0.875rem', lineHeight: 1.45 }}>
            <strong>Local-First User Privacy Guarantee:</strong> Administrator view is restricted
            exclusively to high-level reading metadata (page positions, timestamps, active reading
            time). <strong>User personal notes content is strictly inaccessible</strong> to administrators.
          </div>
        </div>

        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.85rem 1.25rem',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(239, 68, 68, 0.12)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.25)',
            }}
          >
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Filter Toolbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            background: 'var(--bg-secondary)',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-medium)',
          }}
        >
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search by document title or user email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '0.9rem',
              width: '100%',
            }}
          />
        </div>

        {/* Activity Table */}
        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}
        >
          {loading ? (
            <div style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Loader2 className="animate-spin" size={28} style={{ margin: '0 auto 0.5rem' }} />
              <p>Loading user reading activities...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <BookOpen size={44} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
              <p style={{ fontWeight: 600, fontSize: '1.05rem', margin: 0 }}>
                No synchronized reading activity recorded yet
              </p>
              <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                Activity will appear once users read documents and manually synchronize their data.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr
                    style={{
                      borderBottom: '1px solid var(--border-medium)',
                      background: 'rgba(255, 255, 255, 0.02)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.785rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    <th style={{ padding: '0.9rem 1.25rem' }}>Document</th>
                    <th style={{ padding: '0.9rem 1.25rem' }}>User</th>
                    <th style={{ padding: '0.9rem 1.25rem' }}>Progress</th>
                    <th style={{ padding: '0.9rem 1.25rem' }}>Active Time</th>
                    <th style={{ padding: '0.9rem 1.25rem' }}>Last Read</th>
                    <th style={{ padding: '0.9rem 1.25rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: '1px solid var(--border-light, rgba(255, 255, 255, 0.06))',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <td style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <BookOpen size={16} color="var(--accent-primary)" />
                          <span style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.document_title}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <User size={14} color="var(--text-muted)" />
                          <span>{item.user_email}</span>
                        </div>
                      </td>
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', width: '130px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.785rem', color: 'var(--text-secondary)' }}>
                            <span>Page {item.current_page} / {item.total_pages}</span>
                            <span>{Math.round(item.percentage)}%</span>
                          </div>
                          <div
                            style={{
                              width: '100%',
                              height: '6px',
                              background: 'var(--bg-tertiary, rgba(255, 255, 255, 0.08))',
                              borderRadius: '3px',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${Math.min(100, Math.max(0, item.percentage))}%`,
                                height: '100%',
                                background: 'linear-gradient(90deg, #3b82f6, #10b981)',
                                borderRadius: '3px',
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Clock size={14} color="var(--text-muted)" />
                          <span>{formatSeconds(item.active_seconds)}</span>
                        </div>
                      </td>
                      <td style={{ padding: '1rem 1.25rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {item.last_read_at ? new Date(item.last_read_at).toLocaleString() : 'Never'}
                      </td>
                      <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                        <Link
                          href={`/reader/${item.document_id}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.35rem 0.65rem',
                            borderRadius: '6px',
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-medium)',
                            color: 'var(--text-primary)',
                            fontSize: '0.785rem',
                            fontWeight: 600,
                            textDecoration: 'none',
                          }}
                        >
                          View Doc
                        </Link>
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
