'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Send,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  FileText,
  Shield,
  ExternalLink,
  ArrowRight,
  Info,
  Check,
  HelpCircle,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { ContributionSubmission } from '@/lib/types/database';
import { Sidebar } from '@/components/layout/Sidebar';

export default function MyContributionsPage() {
  const [submissions, setSubmissions] = useState<ContributionSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  // Read configured submission group URL from environment
  const telegramGroupUrl = process.env.NEXT_PUBLIC_TELEGRAM_SUBMISSION_GROUP_URL;

  const reload = async () => {
    try {
      setLoading(true);
      const res = await api.contributions.list();
      setSubmissions(res.submissions || []);
    } catch (err) {
      console.error('Error fetching submissions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const getStatusBadge = (status: string) => {
    if (status === 'published') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            color: 'var(--accent-success)',
            background: 'var(--accent-success-light)',
            padding: '0.2rem 0.5rem',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.75rem',
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={12} /> Published
        </span>
      );
    }
    if (status === 'rejected') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            color: 'var(--accent-danger)',
            background: 'var(--accent-danger-light)',
            padding: '0.2rem 0.5rem',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.75rem',
            fontWeight: 600,
          }}
        >
          <XCircle size={12} /> Rejected
        </span>
      );
    }
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.3rem',
          color: 'var(--accent-warning)',
          background: 'var(--accent-warning-light)',
          padding: '0.2rem 0.5rem',
          borderRadius: 'var(--radius-full)',
          fontSize: '0.75rem',
          fontWeight: 600,
        }}
      >
        <Clock size={12} /> Pending Review
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - var(--header-height))', width: '100%' }}>
      <Sidebar />

      <main
        style={{
          flex: 1,
          padding: '2.5rem',
          maxWidth: '1100px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2.25rem',
        }}
      >
        {/* Page Header */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: '0.2rem 0.6rem',
                background: 'rgba(14, 165, 233, 0.12)',
                color: '#0284c7',
                borderRadius: 'var(--radius-full)',
              }}
            >
              <Send size={12} /> Telegram Community Submission
            </span>
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Submit Documents via Telegram
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.35rem', lineHeight: 1.5 }}>
            OpenShelf accepts community PDF contributions exclusively through our official Telegram Submission Group.
            All submitted documents undergo automated integrity checks and administrator review prior to catalog publication.
          </p>
        </div>

        {/* Primary Submission Callout Card */}
        <section
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-lg)',
            padding: '2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '4px',
              background: 'linear-gradient(90deg, #0284c7 0%, #38bdf8 50%, #6366f1 100%)',
            }}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ maxWidth: '640px' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                Official Telegram Submission Group
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                To contribute research papers, study guides, technical notes, or tutorials, join our official Telegram group.
                Send your PDF file directly into the group — our automated system immediately ingests it into the moderation pipeline.
              </p>
            </div>

            {/* Prominent Submit via Telegram Action */}
            <div style={{ alignSelf: 'center' }}>
              {telegramGroupUrl ? (
                <a
                  href={telegramGroupUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  id="submitViaTelegramButton"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    padding: '0.9rem 1.85rem',
                    background: 'linear-gradient(135deg, #0088cc 0%, #006699 100%)',
                    color: '#ffffff',
                    borderRadius: 'var(--radius-md)',
                    fontWeight: 700,
                    fontSize: '1rem',
                    textDecoration: 'none',
                    boxShadow: '0 4px 14px rgba(0, 136, 204, 0.35)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Send size={18} />
                  <span>Submit via Telegram</span>
                  <ExternalLink size={14} style={{ opacity: 0.85 }} />
                </a>
              ) : (
                <div
                  id="telegramUrlNotConfigured"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.8rem 1.25rem',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-muted)',
                    fontSize: '0.875rem',
                  }}
                >
                  <AlertCircle size={16} />
                  <span>Submission Group Link Pending Setup</span>
                </div>
              )}
            </div>
          </div>

          {/* Admin Approval Notice Banner */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              padding: '1rem 1.25rem',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
            }}
          >
            <Shield size={18} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ color: 'var(--accent-primary)' }}>Notice: All Documents Subject to Admin Approval</strong>
              <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.825rem', lineHeight: 1.5 }}>
                Submissions are not published immediately. Every document is reviewed by OpenShelf administrators to ensure copyright compliance,
                content quality, and valid PDF formatting before appearing in the Public Catalog.
              </p>
            </div>
          </div>
        </section>

        {/* Step-by-Step Submission Guide */}
        <section
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <HelpCircle size={20} style={{ color: 'var(--accent-primary)' }} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              How to Submit Your PDF (Step-by-Step)
            </h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1.25rem',
            }}
          >
            {/* Step 1 */}
            <div
              style={{
                background: 'var(--bg-tertiary)',
                padding: '1.25rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: 'var(--accent-primary)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                1
              </div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Open Telegram Group
              </h3>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                Click the <strong>&quot;Submit via Telegram&quot;</strong> button above to open the official OpenShelf submission group. Join if requested.
              </p>
            </div>

            {/* Step 2 */}
            <div
              style={{
                background: 'var(--bg-tertiary)',
                padding: '1.25rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: 'var(--accent-primary)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                2
              </div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Attach &amp; Send PDF
              </h3>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                <strong>Important:</strong> After Telegram opens, manually tap the paperclip icon, select <strong>File / Document</strong> (do not compress as photo), and send your PDF file.
              </p>
            </div>

            {/* Step 3 */}
            <div
              style={{
                background: 'var(--bg-tertiary)',
                padding: '1.25rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: 'var(--accent-primary)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                3
              </div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Add Optional Caption
              </h3>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                You may include an optional caption with the title, author, or subject. Empty captions are also fully accepted; the file name is used automatically.
              </p>
            </div>

            {/* Step 4 */}
            <div
              style={{
                background: 'var(--bg-tertiary)',
                padding: '1.25rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: 'var(--accent-primary)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                4
              </div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Review &amp; Publishing
              </h3>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                Our bot registers the submission into the Admin Pending Review queue. Once reviewed and approved by administrators, it becomes available in the catalog.
              </p>
            </div>
          </div>

          {/* Submission Constraints & Rules */}
          <div
            style={{
              padding: '1rem',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-secondary)',
              borderLeft: '4px solid var(--accent-primary)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
              fontSize: '0.825rem',
              color: 'var(--text-secondary)',
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Submission Guidelines &amp; Constraints:</div>
            <div>&bull; Maximum PDF file size: <strong>20 MB</strong> (via Telegram Cloud Bot API standard).</div>
            <div>&bull; File format: Standard PDF binaries only (<code style={{ fontSize: '0.75rem', padding: '0.1rem 0.3rem', background: 'var(--bg-tertiary)', borderRadius: '3px' }}>%PDF-</code> header validated). Images, audio, and archives are automatically rejected.</div>
            <div>&bull; Redistribution rights: Submitter must hold lawful distribution or open-access rights under our Copyright &amp; Academic Use policy.</div>
          </div>
        </section>

        {/* Submissions Tracking List */}
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              My Submissions History
            </h2>
            <button
              type="button"
              onClick={reload}
              disabled={loading}
              style={{
                fontSize: '0.8rem',
                color: 'var(--accent-primary)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {submissions.length === 0 ? (
            <div
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '2.5rem',
                textAlign: 'center',
                color: 'var(--text-muted)',
              }}
            >
              <FileText size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
              <p style={{ fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 0.25rem' }}>
                No community submissions found yet
              </p>
              <p style={{ fontSize: '0.85rem', margin: 0 }}>
                Use the Telegram Submission Group above to submit your first PDF document for admin moderation.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {submissions.map((sub) => (
                <div
                  key={sub.id}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                        {sub.title}
                      </h3>
                      {getStatusBadge(sub.status)}
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                      {sub.file_name} &bull; {(sub.file_size / (1024 * 1024)).toFixed(1)} MB &bull; Submitted {new Date(sub.created_at).toLocaleDateString()}
                    </span>
                    {sub.rejection_reason && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--accent-danger)', marginTop: '0.35rem' }}>
                        Rejection Reason: {sub.rejection_reason}
                      </div>
                    )}
                  </div>

                  {sub.document_id && (
                    <Link
                      href={`/library/${sub.document_id}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        fontSize: '0.825rem',
                        color: 'var(--accent-primary)',
                        fontWeight: 600,
                        textDecoration: 'none',
                      }}
                    >
                      <span>View in Catalog</span>
                      <ArrowRight size={13} />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
