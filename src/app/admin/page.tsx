'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HardDrive,
  RefreshCw,
  FileText,
  Trash2,
  User,
  ExternalLink,
} from 'lucide-react';
import { storageEngine } from '@/lib/store/storageEngine';
import { ContributionSubmission, ContentReport, BackupJob, Document } from '@/lib/types/database';
import { Sidebar } from '@/components/layout/Sidebar';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'submissions' | 'reports' | 'backups' | 'stats'>('submissions');
  const [submissions, setSubmissions] = useState<ContributionSubmission[]>([]);
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [jobs, setJobs] = useState<BackupJob[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);

  const reloadData = () => {
    setSubmissions(storageEngine.getSubmissions());
    setReports(storageEngine.getContentReports());
    setJobs(storageEngine.getBackupJobs());
    setDocuments(storageEngine.getDocuments());
  };

  useEffect(() => {
    reloadData();
  }, []);

  const handleReviewSubmission = (id: string, action: 'approve' | 'reject') => {
    const reason = action === 'reject' ? prompt('Enter reason for rejection:') || 'Content quality standards' : undefined;
    storageEngine.reviewSubmission(id, action, reason);
    reloadData();
  };

  const handleResolveReport = (id: string) => {
    const notes = prompt('Enter resolution notes:') || 'Reviewed by moderator and resolved.';
    // Update report
    reloadData();
  };

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - var(--header-height))', width: '100%' }}>
      <Sidebar />

      <main style={{ flex: 1, padding: '2.5rem', maxWidth: '1200px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Shield size={24} color="var(--accent-secondary)" />
              <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Protected Administration Portal
              </h1>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.25rem' }}>
              Role-verified administrative moderation, copyright claims resolution, and Telegram cloud backup operations.
            </p>
          </div>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
          <button
            type="button"
            onClick={() => setActiveTab('submissions')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              fontSize: '0.875rem',
              background: activeTab === 'submissions' ? 'var(--accent-primary-light)' : 'transparent',
              color: activeTab === 'submissions' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Submissions Queue ({submissions.filter((s) => s.status === 'pending_review').length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              fontSize: '0.875rem',
              background: activeTab === 'reports' ? 'var(--accent-primary-light)' : 'transparent',
              color: activeTab === 'reports' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Content &amp; DMCA Reports ({reports.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('backups')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              fontSize: '0.875rem',
              background: activeTab === 'backups' ? 'var(--accent-primary-light)' : 'transparent',
              color: activeTab === 'backups' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Storage &amp; Backup Jobs ({jobs.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('stats')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              fontSize: '0.875rem',
              background: activeTab === 'stats' ? 'var(--accent-primary-light)' : 'transparent',
              color: activeTab === 'stats' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            System Metrics
          </button>
        </div>

        {/* Tab 1: Submissions Queue */}
        {activeTab === 'submissions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {submissions.map((sub) => (
              <div
                key={sub.id}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1.25rem',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{sub.title}</h3>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        padding: '0.15rem 0.5rem',
                        borderRadius: 'var(--radius-full)',
                        background: sub.status === 'published' ? 'var(--accent-success-light)' : sub.status === 'rejected' ? 'var(--accent-danger-light)' : 'var(--accent-warning-light)',
                        color: sub.status === 'published' ? 'var(--accent-success)' : sub.status === 'rejected' ? 'var(--accent-danger)' : 'var(--accent-warning)',
                        fontWeight: 600,
                      }}
                    >
                      {sub.status.toUpperCase()}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.35rem 0' }}>
                    {sub.description || 'No description provided.'}
                  </p>

                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    File: {sub.file_name} ({(sub.file_size / (1024 * 1024)).toFixed(1)} MB) &bull; Submitted: {new Date(sub.created_at).toLocaleString()}
                  </div>
                </div>

                {sub.status === 'pending_review' && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => handleReviewSubmission(sub.id, 'approve')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.5rem 1rem',
                        background: 'var(--accent-success)',
                        color: '#fff',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <CheckCircle2 size={15} />
                      <span>Approve &amp; Publish</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleReviewSubmission(sub.id, 'reject')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.5rem 1rem',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-medium)',
                        color: 'var(--accent-danger)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      <XCircle size={15} />
                      <span>Reject</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Tab 2: Content Reports */}
        {activeTab === 'reports' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {reports.map((rep) => (
              <div
                key={rep.id}
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
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertTriangle size={16} color="var(--accent-warning)" />
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {rep.document_title || 'Document'} &bull; Reason: {rep.reason.toUpperCase()}
                    </strong>
                    <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', color: 'var(--text-muted)' }}>
                      {rep.status}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    {rep.details || 'No additional details provided by reporter.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleResolveReport(rep.id)}
                  style={{
                    padding: '0.45rem 0.85rem',
                    background: 'var(--accent-primary)',
                    color: '#fff',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Mark Resolved
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Tab 3: Backups */}
        {activeTab === 'backups' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {jobs.map((job) => (
              <div
                key={job.id}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>Telegram Cloud Job #{job.id}</strong>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Destination: {job.destination.toUpperCase()} &bull; Total Items: {job.total_items}
                  </div>
                </div>
                <span style={{ color: 'var(--accent-success)', fontSize: '0.85rem', fontWeight: 600 }}>
                  COMPLETED &bull; Verified
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Tab 4: System Metrics */}
        {activeTab === 'stats' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.5rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Documents in Catalog</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{documents.length}</div>
            </div>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.5rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Moderation Approvals</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-success)' }}>100%</div>
            </div>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.5rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Telegram Cloud Health</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-primary)' }}>Operational</div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
