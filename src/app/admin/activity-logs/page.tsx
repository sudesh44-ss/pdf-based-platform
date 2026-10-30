'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { History, Loader2, AlertCircle } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminActivityLog } from '@/lib/types/database';

export default function AdminActivityLogsPage() {
  const [logs, setLogs] = useState<AdminActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/activity-logs?limit=50')
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const data = await res.json();
        setLogs(data.data?.logs || []);
      })
      .catch((err) => {
        setError(err.message || 'Failed to fetch logs');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <AdminLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Administrative Activity Audit Trail
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', marginTop: '0.35rem' }}>
            Immutable record of administrator logins, approvals, rejections, category edits, and deletions.
          </p>
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.85rem 1.25rem', borderRadius: 'var(--radius-md)', background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Loader2 className="animate-spin" size={26} style={{ margin: '0 auto 0.5rem' }} />
              <p>Fetching audit events...</p>
            </div>
          ) : logs.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <History size={40} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
              <p>No activity records logged yet.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-medium)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                    <th style={{ padding: '0.85rem 1rem' }}>Admin / Operator</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Action</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Target</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Details</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {log.admin_username}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span
                          style={{
                            padding: '0.2rem 0.55rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background:
                              log.action.includes('approved')
                                ? 'rgba(34, 197, 94, 0.12)'
                                : log.action.includes('rejected')
                                ? 'rgba(239, 68, 68, 0.12)'
                                : 'var(--bg-tertiary)',
                            color:
                              log.action.includes('approved')
                                ? '#22c55e'
                                : log.action.includes('rejected')
                                ? '#ef4444'
                                : 'var(--text-secondary)',
                          }}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)' }}>
                        {log.target_type ? `${log.target_type} (${log.target_id?.slice(0, 8) || 'N/A'})` : 'System'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)', maxWidth: '300px' }}>
                        <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {JSON.stringify(log.details)}
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)' }}>
                        {new Date(log.created_at).toLocaleString()}
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
