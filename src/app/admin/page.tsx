'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Files,
  UploadCloud,
  Clock,
  CheckCircle2,
  XCircle,
  FolderTree,
  History,
  ArrowRight,
  Loader2,
  AlertCircle,
  Eye,
  FileCheck,
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = () => {
    setLoading(true);
    setError(null);
    fetch('/api/admin/dashboard')
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const data = await res.json();
        setMetrics(data.data);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load dashboard metrics');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const formatTime = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <AdminLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Administration &amp; Workflow Overview
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', marginTop: '0.35rem' }}>
              Real-time Telegram uploads, approval queue status, and public catalog metrics.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
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
              <span>Open Review Queue</span>
            </Link>
          </div>
        </div>

        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '1rem',
              background: 'rgba(239, 68, 68, 0.1)',
              borderRadius: 'var(--radius-md)',
              color: '#ef4444',
            }}
          >
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Stats Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1.25rem',
          }}
        >
          <div
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                PENDING UPLOADS
              </span>
              <div style={{ padding: '0.4rem', background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', borderRadius: '6px' }}>
                <Clock size={18} />
              </div>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {loading ? <Loader2 className="animate-spin" size={24} /> : metrics?.pendingUploads || 0}
            </div>
            <Link href="/admin/pending" style={{ fontSize: '0.8rem', color: '#f59e0b', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
              Review awaiting items &rarr;
            </Link>
          </div>

          <div
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                PUBLISHED DOCUMENTS
              </span>
              <div style={{ padding: '0.4rem', background: 'rgba(34, 197, 94, 0.12)', color: '#22c55e', borderRadius: '6px' }}>
                <CheckCircle2 size={18} />
              </div>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {loading ? <Loader2 className="animate-spin" size={24} /> : metrics?.publishedDocuments || 0}
            </div>
            <Link href="/admin/published" style={{ fontSize: '0.8rem', color: '#22c55e', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
              View public catalog &rarr;
            </Link>
          </div>

          <div
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                REJECTED UPLOADS
              </span>
              <div style={{ padding: '0.4rem', background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', borderRadius: '6px' }}>
                <XCircle size={18} />
              </div>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {loading ? <Loader2 className="animate-spin" size={24} /> : metrics?.rejectedUploads || 0}
            </div>
            <Link href="/admin/rejected" style={{ fontSize: '0.8rem', color: '#ef4444', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
              View rejection reasons &rarr;
            </Link>
          </div>

          <div
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                CATEGORIES ACTIVE
              </span>
              <div style={{ padding: '0.4rem', background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', borderRadius: '6px' }}>
                <FolderTree size={18} />
              </div>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {loading ? <Loader2 className="animate-spin" size={24} /> : metrics?.totalCategories || 0}
            </div>
            <Link href="/admin/categories" style={{ fontSize: '0.8rem', color: '#3b82f6', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
              Manage taxonomy &rarr;
            </Link>
          </div>
        </div>

        {/* Recent Admin Activity Table */}
        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <History size={18} />
              <span>Recent Administrative Activities</span>
            </h2>
            <Link href="/admin/activity-logs" style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600 }}>
              Full Audit Trail &rarr;
            </Link>
          </div>

          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Loader2 className="animate-spin" size={24} style={{ margin: '0 auto 0.5rem' }} />
              <p>Fetching activity logs...</p>
            </div>
          ) : !metrics?.recentActivities || metrics.recentActivities.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No administrative events recorded yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-medium)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Admin / Source</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Action</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Target</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.recentActivities.map((act: any) => (
                    <tr key={act.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {act.admin_username}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <span
                          style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background:
                              act.action.includes('approved')
                                ? 'rgba(34, 197, 94, 0.12)'
                                : act.action.includes('rejected')
                                ? 'rgba(239, 68, 68, 0.12)'
                                : 'var(--bg-tertiary)',
                            color:
                              act.action.includes('approved')
                                ? '#22c55e'
                                : act.action.includes('rejected')
                                ? '#ef4444'
                                : 'var(--text-secondary)',
                          }}
                        >
                          {act.action}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)' }}>
                        {act.target_type ? `${act.target_type} (${act.target_id?.slice(0, 8) || 'N/A'})` : 'System'}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)' }}>
                        {formatTime(act.created_at)}
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
