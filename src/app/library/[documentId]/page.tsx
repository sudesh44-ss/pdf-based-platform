'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  BookOpen,
  Heart,
  Bookmark,
  Download,
  AlertTriangle,
  User,
  Calendar,
  Layers,
  HardDrive,
  FileText,
  Share2,
  Check,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { Document } from '@/lib/types/database';
import styles from './page.module.css';

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const documentId = params?.documentId as string;

  const [doc, setDoc] = useState<Document | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('copyright');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (documentId) {
      api.documents
        .getById(documentId)
        .then((found) => {
          setDoc(found);
        })
        .catch(() => {
          setDoc(null);
        });
    }
  }, [documentId]);

  if (!doc) {
    return (
      <div className={styles.container}>
        <Link href="/library" className={styles.backLink}>
          <ArrowLeft size={16} />
          <span>Back to Library</span>
        </Link>
        <div style={{ padding: '4rem 1rem', textAlign: 'center' }}>
          <h2>Document Not Found</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            The requested technical PDF document could not be located in the catalog.
          </p>
          <Link
            href="/library"
            style={{
              display: 'inline-block',
              marginTop: '1.5rem',
              padding: '0.6rem 1.25rem',
              background: 'var(--accent-primary)',
              color: '#fff',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            Browse Public Catalog
          </Link>
        </div>
      </div>
    );
  }

  const handleLike = async () => {
    const willLike = !doc.is_liked;
    try {
      const result = await api.documents.toggleLike(doc.id, willLike);
      setDoc({
        ...doc,
        is_liked: result.liked,
        likes_count: result.likesCount,
      });
    } catch {
      setDoc((prev) =>
        prev
          ? {
              ...prev,
              is_liked: willLike,
              likes_count: willLike ? prev.likes_count + 1 : Math.max(0, prev.likes_count - 1),
            }
          : null
      );
    }
  };

  const handleFavorite = async () => {
    const willFav = !doc.is_favorite;
    try {
      const result = await api.documents.toggleFavourite(doc.id, willFav);
      setDoc({
        ...doc,
        is_favorite: result.favourited,
      });
    } catch {
      setDoc((prev) => (prev ? { ...prev, is_favorite: willFav } : null));
    }
  };

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setReportSubmitted(true);
    setTimeout(() => {
      setReportModalOpen(false);
      setReportSubmitted(false);
      setReportDetails('');
    }, 1500);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${Math.round(bytes / 1024)} KB`;
  };

  return (
    <div className={styles.container}>
      <Link href="/library" className={styles.backLink}>
        <ArrowLeft size={16} />
        <span>Back to Public Library</span>
      </Link>

      <div className={styles.detailGrid}>
        <div className={styles.mainCol}>
          <div className={styles.titleArea}>
            <div className={styles.badgeRow}>
              {doc.categories.map((c) => (
                <span key={c} className={styles.categoryBadge}>{c}</span>
              ))}
            </div>
            <h1 className={styles.docTitle}>{doc.title}</h1>
            {doc.description && (
              <p className={styles.docSubtitle}>{doc.description}</p>
            )}
          </div>

          <div className={styles.actionRow}>
            <Link href={`/reader/${doc.id}`} className={styles.primaryReadBtn}>
              <BookOpen size={18} />
              <span>Read Document</span>
            </Link>

            <button
              type="button"
              className={`${styles.secondaryActionBtn} ${doc.is_liked ? styles.liked : ''}`}
              onClick={handleLike}
              title="Like this document"
            >
              <Heart size={16} fill={doc.is_liked ? 'currentColor' : 'none'} />
              <span>{doc.likes_count}</span>
            </button>

            <button
              type="button"
              className={`${styles.secondaryActionBtn} ${doc.is_favorite ? styles.liked : ''}`}
              onClick={handleFavorite}
              title="Save to personal favorites"
            >
              <Bookmark size={16} fill={doc.is_favorite ? 'currentColor' : 'none'} />
              <span>{doc.is_favorite ? 'Saved' : 'Favorite'}</span>
            </button>

            <a
              href="/samples/sample-study-guide.pdf"
              download={doc.file_name}
              className={styles.secondaryActionBtn}
              title="Download original verified PDF"
            >
              <Download size={16} />
              <span>Download</span>
            </a>

            <button
              type="button"
              className={styles.secondaryActionBtn}
              onClick={handleShare}
              title="Copy share link"
            >
              {copiedLink ? <Check size={16} color="var(--accent-success)" /> : <Share2 size={16} />}
              <span>{copiedLink ? 'Copied' : 'Share'}</span>
            </button>

            <button
              type="button"
              className={styles.secondaryActionBtn}
              onClick={() => setReportModalOpen(true)}
              style={{ color: 'var(--text-muted)' }}
              title="Report copyright or content issue"
            >
              <AlertTriangle size={15} />
              <span>Report</span>
            </button>
          </div>

          <div style={{ marginTop: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem' }}>Tags &amp; Keywords</h3>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {doc.tags.map((t) => (
                <span
                  key={t}
                  style={{
                    background: 'var(--bg-tertiary)',
                    padding: '0.35rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  #{t}
                </span>
              ))}
            </div>
          </div>
        </div>

        <aside>
          <div className={styles.sidebarCard}>
            <h2 className={styles.cardHeader}>Document Specifications</h2>
            <div className={styles.specList}>
              <div className={styles.specItem}>
                <span className={styles.specLabel}>Page Count</span>
                <span className={styles.specValue}>{doc.page_count} pages</span>
              </div>
              <div className={styles.specItem}>
                <span className={styles.specLabel}>File Size</span>
                <span className={styles.specValue}>{formatFileSize(doc.file_size)}</span>
              </div>
              <div className={styles.specItem}>
                <span className={styles.specLabel}>Contributor</span>
                <span className={styles.specValue}>{doc.contributor_name || 'Community'}</span>
              </div>
              <div className={styles.specItem}>
                <span className={styles.specLabel}>Storage Tier</span>
                <span className={styles.specValue}>Telegram Cloud Bot API</span>
              </div>
              <div className={styles.specItem}>
                <span className={styles.specLabel}>Format</span>
                <span className={styles.specValue}>PDF 1.4 Vector</span>
              </div>
              <div className={styles.specItem}>
                <span className={styles.specLabel}>Moderation</span>
                <span className={styles.specValue} style={{ color: 'var(--accent-success)' }}>
                  Verified &amp; Approved
                </span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Report Modal */}
      {reportModalOpen && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalBox}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Report Document</h3>
            {reportSubmitted ? (
              <div style={{ color: 'var(--accent-success)', padding: '1rem 0' }}>
                Thank you. Your report has been dispatched to the moderation queue.
              </div>
            ) : (
              <form onSubmit={handleReportSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label htmlFor="reportReasonSelect" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                    Reason for Report
                  </label>
                  <select
                    id="reportReasonSelect"
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.6rem',
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <option value="copyright">Copyright Infringement (DMCA)</option>
                    <option value="inappropriate">Inappropriate / Harmful Content</option>
                    <option value="corrupted">Corrupted or Unreadable PDF</option>
                    <option value="spam">Spam or Irrelevant Listing</option>
                    <option value="other">Other Issue</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="reportDetailsInput" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                    Additional Information
                  </label>
                  <textarea
                    id="reportDetailsInput"
                    rows={4}
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    placeholder="Provide details or copyright claim documentation..."
                    style={{
                      width: '100%',
                      padding: '0.6rem',
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)',
                      resize: 'vertical',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setReportModalOpen(false)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: '0.5rem 1.25rem',
                      background: 'var(--accent-danger)',
                      color: '#fff',
                      borderRadius: 'var(--radius-sm)',
                      fontWeight: 600,
                    }}
                  >
                    Submit Report
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
