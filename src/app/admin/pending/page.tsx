'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  Edit3,
  Loader2,
  AlertCircle,
  FileText,
  Tag,
  Save,
  Check,
  UploadCloud,
  AlertTriangle,
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { TelegramUpload, Category } from '@/lib/types/database';

function PendingQueueContent() {
  const searchParams = useSearchParams();
  const preselectedId = searchParams.get('id');

  const [uploads, setUploads] = useState<TelegramUpload[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedUpload, setSelectedUpload] = useState<TelegramUpload | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Metadata form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [tags, setTags] = useState('');
  const [author, setAuthor] = useState('');
  const [language, setLanguage] = useState('en');
  const [publicationYear, setPublicationYear] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  // Direct upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadCategory, setUploadCategory] = useState('');
  const [uploadTags, setUploadTags] = useState('');
  const [uploadAuthor, setUploadAuthor] = useState('');
  const [uploadYear, setUploadYear] = useState('');
  const [uploadingDirect, setUploadingDirect] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [uploadsRes, catsRes] = await Promise.all([
        fetch('/api/admin/uploads?status=pending').then((r) => r.json()),
        fetch('/api/admin/categories').then((r) => r.json()),
      ]);

      const items: TelegramUpload[] = uploadsRes.data?.uploads || [];
      setUploads(items);
      setCategories(catsRes.data?.categories || []);

      if (items.length > 0) {
        const target = preselectedId ? items.find((u) => u.id === preselectedId) || items[0] : items[0];
        selectItem(target);
      } else {
        setSelectedUpload(null);
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to load review queue', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [preselectedId]);

  const selectItem = (upload: TelegramUpload) => {
    setSelectedUpload(upload);
    setTitle(upload.title || '');
    setDescription(upload.description || '');
    setCategoryName(upload.category_name || 'Computer Science');
    setTags((upload.tags || []).join(', '));
    setAuthor(upload.author || '');
    setLanguage(upload.language || 'en');
    setPublicationYear(upload.publication_year ? String(upload.publication_year) : '');
  };

  const handleSaveMetadata = async () => {
    if (!selectedUpload) return;
    setActionLoading(true);
    setMessage(null);

    const tagArray = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      const res = await fetch(`/api/admin/uploads/${selectedUpload.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          category_name: categoryName,
          tags: tagArray,
          author,
          language,
          publication_year: publicationYear ? parseInt(publicationYear, 10) : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error?.message || 'Update failed');

      setSelectedUpload(data.data);
      setMessage({ text: 'Metadata updated successfully!', type: 'success' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ text: err.message || 'Error updating metadata', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedUpload) return;
    if (!title.trim()) {
      setMessage({ text: 'Please ensure a valid PDF Title is provided before publishing.', type: 'error' });
      return;
    }

    setActionLoading(true);
    setMessage(null);

    try {
      // 1. Save any pending metadata changes first
      const tagArray = tags.split(',').map((t) => t.trim()).filter(Boolean);
      await fetch(`/api/admin/uploads/${selectedUpload.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          category_name: categoryName,
          tags: tagArray,
          author,
          language,
          publication_year: publicationYear ? parseInt(publicationYear, 10) : undefined,
        }),
      });

      // 2. Trigger approve & publish
      const res = await fetch(`/api/admin/uploads/${selectedUpload.id}/approve`, {
        method: 'POST',
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error?.message || 'Approval failed');

      setMessage({ text: `"${title}" approved and published to Public Library!`, type: 'success' });
      // Refresh list
      await fetchData();
    } catch (err: any) {
      setMessage({ text: err.message || 'Error approving upload', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedUpload) return;
    setActionLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/uploads/${selectedUpload.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectionReason }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error?.message || 'Rejection failed');

      setShowRejectModal(false);
      setRejectionReason('');
      setMessage({ text: 'Upload marked as rejected.', type: 'success' });
      await fetchData();
    } catch (err: any) {
      setMessage({ text: err.message || 'Error rejecting upload', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDirectUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setMessage({ text: 'Please select a PDF file to upload', type: 'error' });
      return;
    }

    const MAX_DIRECT_BYTES = 4 * 1024 * 1024; // 4 MB Vercel Serverless Function Limit
    if (uploadFile.size > MAX_DIRECT_BYTES) {
      setMessage({
        text: `Selected PDF is ${(uploadFile.size / (1024 * 1024)).toFixed(2)} MB. Direct browser uploads are limited to 4 MB to prevent Vercel Serverless payload errors. For files up to 20 MB, please post directly into your authorized Telegram group for automatic ingestion.`,
        type: 'error',
      });
      return;
    }

    setUploadingDirect(true);
    setMessage(null);

    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('title', uploadTitle);
    formData.append('description', uploadDesc);
    formData.append('category_name', uploadCategory || (categories[0]?.name || 'General Reference'));
    formData.append('tags', uploadTags);
    formData.append('author', uploadAuthor);
    if (uploadYear) formData.append('publication_year', uploadYear);

    try {
      const res = await fetch('/api/admin/uploads', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Direct upload to Telegram failed');
      }

      setShowUploadModal(false);
      setUploadFile(null);
      setUploadTitle('');
      setUploadDesc('');
      setUploadTags('');
      setUploadAuthor('');
      setUploadYear('');
      setMessage({
        text: 'PDF uploaded directly to Telegram central storage and queued for review!',
        type: 'success',
      });
      await fetchData();
    } catch (err: any) {
      setMessage({ text: err.message || 'Error uploading PDF', type: 'error' });
    } finally {
      setUploadingDirect(false);
    }
  };

  return (
    <AdminLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              PDF Moderation &amp; Publishing Queue
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', marginTop: '0.35rem' }}>
              Review ingested PDFs from Telegram, enrich academic metadata, and publish to the public library catalog.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowUploadModal(true)}
            style={{
              padding: '0.65rem 1.25rem',
              background: 'var(--accent-primary)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontWeight: 700,
              fontSize: '0.875rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <UploadCloud size={18} />
            <span>+ Direct Upload to Telegram</span>
          </button>
        </div>

        {message && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.85rem 1.25rem',
              borderRadius: 'var(--radius-md)',
              background: message.type === 'success' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              color: message.type === 'success' ? '#22c55e' : '#ef4444',
              border: `1px solid ${message.type === 'success' ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
              fontSize: '0.9rem',
              fontWeight: 600,
            }}
          >
            {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{message.text}</span>
          </div>
        )}

        {loading ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader2 className="animate-spin" size={32} style={{ margin: '0 auto 0.75rem' }} />
            <p>Loading pending review queue...</p>
          </div>
        ) : uploads.length === 0 ? (
          <div
            style={{
              padding: '4rem 2rem',
              textAlign: 'center',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            <CheckCircle2 size={48} color="#22c55e" style={{ margin: '0 auto 1rem' }} />
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Queue Completely Clear!
            </h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '480px', margin: '0.5rem auto 0' }}>
              All incoming Telegram uploads have been processed. New PDF documents sent to your configured Telegram channels will automatically arrive here.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem', alignItems: 'start' }}>
            {/* Left Queue List */}
            <div
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                maxHeight: 'calc(100vh - 200px)',
              }}
            >
              <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-medium)', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Awaiting Review</span>
                <span style={{ padding: '0.15rem 0.5rem', background: 'var(--bg-tertiary)', borderRadius: '12px', fontSize: '0.8rem' }}>
                  {uploads.length}
                </span>
              </div>

              <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                {uploads.map((u) => {
                  const isSelected = selectedUpload?.id === u.id;
                  return (
                    <button
                      key={u.id}
                      onClick={() => selectItem(u)}
                      style={{
                        padding: '1rem',
                        textAlign: 'left',
                        background: isSelected ? 'var(--bg-tertiary)' : 'transparent',
                        border: 'none',
                        borderBottom: '1px solid var(--border-light)',
                        borderLeft: isSelected ? '3px solid var(--accent-primary)' : '3px solid transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.35rem',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', lineClamp: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {u.title}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {(u.file_size / (1024 * 1024)).toFixed(1)} MB • {u.original_filename}
                      </div>
                      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', marginTop: '0.15rem' }}>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px',
                            background: u.source_type === 'admin_upload' ? 'rgba(99, 102, 241, 0.12)' : 'rgba(14, 165, 233, 0.12)',
                            color: u.source_type === 'admin_upload' ? '#6366f1' : '#0284c7',
                          }}
                        >
                          {u.source_type === 'admin_upload' ? 'Admin Direct' : 'Telegram Group'}
                        </span>
                        {u.is_duplicate && (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              padding: '0.1rem 0.4rem',
                              borderRadius: '4px',
                              background: 'rgba(245, 158, 11, 0.15)',
                              color: '#d97706',
                            }}
                          >
                            Duplicate
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Review and Metadata Workspace */}
            {selectedUpload && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Duplicate Warning Banner */}
                {selectedUpload.is_duplicate && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                      padding: '1rem 1.25rem',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(245, 158, 11, 0.12)',
                      border: '1px solid rgba(245, 158, 11, 0.35)',
                      color: '#d97706',
                    }}
                  >
                    <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ fontSize: '0.875rem' }}>
                      <strong>Duplicate File Content Detected</strong>
                      <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.825rem' }}>
                        This PDF binary matches an existing upload in the system (file_unique_id fingerprint duplicate{selectedUpload.duplicate_of_id ? ` of ID ${selectedUpload.duplicate_of_id}` : ''}). Please verify whether this is an intended re-upload before approving to avoid redundant library entries.
                      </p>
                    </div>
                  </div>
                )}
                {/* PDF Viewer Preview Container */}
                <div
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-lg)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '0.85rem 1.25rem',
                      background: 'var(--bg-tertiary)',
                      borderBottom: '1px solid var(--border-medium)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                      Telegram PDF Binary Preview
                    </span>
                    <a
                      href={`/api/admin/uploads/${selectedUpload.id}/file`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: '0.8rem',
                        color: 'var(--accent-primary)',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontWeight: 600,
                      }}
                    >
                      <span>Open in New Tab</span>
                      <Eye size={13} />
                    </a>
                  </div>

                  <div style={{ height: '420px', background: '#525659' }}>
                    <iframe
                      src={`/api/admin/uploads/${selectedUpload.id}/file`}
                      style={{ width: '100%', height: '100%', border: 'none' }}
                      title="PDF Preview"
                    />
                  </div>
                </div>

                {/* Metadata Editor Form */}
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
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    Publication Metadata &amp; Categorization
                  </h2>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                        Publication Title *
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--border-medium)',
                          borderRadius: 'var(--radius-md)',
                          color: 'var(--text-primary)',
                          fontSize: '0.95rem',
                          fontWeight: 600,
                        }}
                      />
                    </div>

                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                        Description / Abstract
                      </label>
                      <textarea
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Provide an informative academic abstract or study guide summary..."
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--border-medium)',
                          borderRadius: 'var(--radius-md)',
                          color: 'var(--text-primary)',
                          fontSize: '0.875rem',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                        Discipline / Category *
                      </label>
                      <select
                        value={categoryName}
                        onChange={(e) => setCategoryName(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--border-medium)',
                          borderRadius: 'var(--radius-md)',
                          color: 'var(--text-primary)',
                          fontSize: '0.875rem',
                        }}
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                        Author / Institution
                      </label>
                      <input
                        type="text"
                        value={author}
                        onChange={(e) => setAuthor(e.target.value)}
                        placeholder="e.g. MIT OpenCourseWare, Prof. Donald Knuth"
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--border-medium)',
                          borderRadius: 'var(--radius-md)',
                          color: 'var(--text-primary)',
                          fontSize: '0.875rem',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                        Tags (Comma separated)
                      </label>
                      <input
                        type="text"
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                        placeholder="algorithms, data-structures, comp-sci"
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--border-medium)',
                          borderRadius: 'var(--radius-md)',
                          color: 'var(--text-primary)',
                          fontSize: '0.875rem',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                        Publication Year
                      </label>
                      <input
                        type="number"
                        value={publicationYear}
                        onChange={(e) => setPublicationYear(e.target.value)}
                        placeholder="2026"
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--border-medium)',
                          borderRadius: 'var(--radius-md)',
                          color: 'var(--text-primary)',
                          fontSize: '0.875rem',
                        }}
                      />
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingTop: '1.25rem',
                      borderTop: '1px solid var(--border-light)',
                      flexWrap: 'wrap',
                      gap: '1rem',
                    }}
                  >
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={handleSaveMetadata}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.65rem 1.15rem',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-medium)',
                        borderRadius: 'var(--radius-md)',
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                      }}
                    >
                      <Save size={16} />
                      <span>Save Draft Metadata</span>
                    </button>

                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => setShowRejectModal(true)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          padding: '0.65rem 1.15rem',
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          borderRadius: 'var(--radius-md)',
                          fontWeight: 700,
                          fontSize: '0.875rem',
                          color: '#ef4444',
                          cursor: 'pointer',
                        }}
                      >
                        <XCircle size={16} />
                        <span>Reject Upload</span>
                      </button>

                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={handleApprove}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          padding: '0.65rem 1.5rem',
                          background: '#22c55e',
                          border: 'none',
                          borderRadius: 'var(--radius-md)',
                          fontWeight: 700,
                          fontSize: '0.9rem',
                          color: '#fff',
                          cursor: 'pointer',
                        }}
                      >
                        {actionLoading ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                        <span>Approve &amp; Publish</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reject Reason Modal */}
        {showRejectModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.65)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100,
              padding: '1.5rem',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '480px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
              }}
            >
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Reject Telegram Upload
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Please specify why this document is being rejected. This reason will be logged for administrative auditing.
              </p>
              <textarea
                rows={3}
                placeholder="e.g. Scanned document corrupted, non-academic material, copyright conflict..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  style={{
                    padding: '0.55rem 1rem',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleReject}
                  style={{
                    padding: '0.55rem 1.25rem',
                    background: '#ef4444',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    color: '#fff',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Direct Admin PDF Upload Modal */}
        {showUploadModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.65)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100,
              padding: '1.5rem',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '560px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
                maxHeight: '90vh',
                overflowY: 'auto',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <UploadCloud size={20} color="var(--accent-primary)" />
                  <span>Direct Upload to Telegram</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.25rem' }}
                >
                  &times;
                </button>
              </div>

              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                Upload a PDF directly from your computer. The binary will be uploaded straight to your Telegram central storage and queued in the review list.
              </p>

              <div
                style={{
                  padding: '0.75rem 1rem',
                  background: 'rgba(59, 130, 246, 0.08)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.4,
                }}
              >
                <strong style={{ color: 'var(--accent-primary)' }}>Vercel Payload Limit (4 MB):</strong> Direct browser uploads are capped at 4 MB to ensure compatibility with Vercel Serverless Functions. For larger PDF files (up to 20 MB), simply post the document directly into your authorized Telegram Group or Channel—the bot webhook will automatically ingest it without size restrictions.
              </div>

              <form onSubmit={handleDirectUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                    Select PDF File * (max 4 MB)
                  </label>
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    required
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      if (!f) {
                        setUploadFile(null);
                        return;
                      }
                      if (!f.name.toLowerCase().endsWith('.pdf')) {
                        setMessage({ text: 'Selected file must have a .pdf extension', type: 'error' });
                        e.target.value = '';
                        setUploadFile(null);
                        return;
                      }
                      if (f.size > 4 * 1024 * 1024) {
                        setMessage({
                          text: `Selected file is ${(f.size / (1024 * 1024)).toFixed(2)} MB. Direct uploads via Vercel are limited to 4 MB. For files between 4 MB and 20 MB, post directly into your authorized Telegram Group for automatic ingestion.`,
                          type: 'error',
                        });
                        e.target.value = '';
                        setUploadFile(null);
                        return;
                      }
                      setUploadFile(f);
                      if (!uploadTitle) {
                        setUploadTitle(f.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' '));
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '0.55rem',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                    Document Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Distributed Consensus Systems"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      fontSize: '0.875rem',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                    Primary Category
                  </label>
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      fontSize: '0.875rem',
                    }}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                    Author / Attribution
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Leslie Lamport"
                    value={uploadAuthor}
                    onChange={(e) => setUploadAuthor(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      fontSize: '0.875rem',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                    Description
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Short description or abstract..."
                    value={uploadDesc}
                    onChange={(e) => setUploadDesc(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      fontSize: '0.875rem',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                      Tags (comma separated)
                    </label>
                    <input
                      type="text"
                      placeholder="algorithms, distributed"
                      value={uploadTags}
                      onChange={(e) => setUploadTags(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.65rem 0.85rem',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-medium)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)',
                        fontSize: '0.875rem',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                      Publication Year
                    </label>
                    <input
                      type="number"
                      placeholder="2024"
                      value={uploadYear}
                      onChange={(e) => setUploadYear(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.65rem 0.85rem',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-medium)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)',
                        fontSize: '0.875rem',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    style={{
                      padding: '0.6rem 1.25rem',
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploadingDirect}
                    style={{
                      padding: '0.6rem 1.5rem',
                      background: 'var(--accent-primary)',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      color: '#fff',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    {uploadingDirect ? <Loader2 className="animate-spin" size={16} /> : <UploadCloud size={16} />}
                    <span>Upload to Telegram</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default function PendingReviewPage() {
  return (
    <Suspense
      fallback={
        <AdminLayout>
          <div style={{ padding: '4rem', textAlign: 'center' }}>
            <Loader2 className="animate-spin" size={28} />
          </div>
        </AdminLayout>
      }
    >
      <PendingQueueContent />
    </Suspense>
  );
}
