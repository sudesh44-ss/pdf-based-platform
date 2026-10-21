'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  UploadCloud,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  FileText,
  Shield,
  Layers,
} from 'lucide-react';
import { storageEngine } from '@/lib/store/storageEngine';
import { ContributionSubmission } from '@/lib/types/database';
import { validatePdfBuffer } from '@/lib/pdf/validator';
import { Sidebar } from '@/components/layout/Sidebar';

export default function MyContributionsPage() {
  const [submissions, setSubmissions] = useState<ContributionSubmission[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categories, setCategories] = useState('Computer Science, Distributed Systems');
  const [tags, setTags] = useState('Architecture, Cloud, Microservices');
  const [rightsDeclared, setRightsDeclared] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const reload = () => {
    setSubmissions(storageEngine.getSubmissions());
  };

  useEffect(() => {
    reload();
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setValidationError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    if (!title) {
      setTitle(file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' '));
    }

    try {
      const buffer = await file.arrayBuffer();
      const validation = validatePdfBuffer(new Uint8Array(buffer));
      if (!validation.isValid) {
        setValidationError(validation.error || 'Invalid PDF binary structure.');
      }
    } catch {
      setValidationError('Failed to inspect PDF structure.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setValidationError('Please select a PDF file.');
      return;
    }
    if (!rightsDeclared) {
      setValidationError('You must declare that you possess redistribution rights.');
      return;
    }

    setSubmitting(true);
    setValidationError(null);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const validation = validatePdfBuffer(new Uint8Array(buffer));

      if (!validation.isValid) {
        setValidationError(validation.error || 'PDF binary validation failed.');
        setSubmitting(false);
        return;
      }

      storageEngine.createSubmission({
        title: title.trim(),
        description: description.trim(),
        file_name: selectedFile.name,
        file_size: selectedFile.size,
        categories: categories.split(',').map((c) => c.trim()).filter(Boolean),
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        rights_declared: rightsDeclared,
      });

      setSubmitting(false);
      setSuccessMessage('Your PDF has been submitted to the moderation queue for review.');
      setTitle('');
      setDescription('');
      setSelectedFile(null);
      setRightsDeclared(false);
      reload();

      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setValidationError(err.message || 'Submission failed.');
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'published') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: 'var(--accent-success)', background: 'var(--accent-success-light)', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', fontWeight: 600 }}>
          <CheckCircle2 size={12} /> Published
        </span>
      );
    }
    if (status === 'rejected') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: 'var(--accent-danger)', background: 'var(--accent-danger-light)', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', fontWeight: 600 }}>
          <XCircle size={12} /> Rejected
        </span>
      );
    }
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: 'var(--accent-warning)', background: 'var(--accent-warning-light)', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', fontWeight: 600 }}>
        <Clock size={12} /> Pending Review
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - var(--header-height))', width: '100%' }}>
      <Sidebar />

      <main style={{ flex: 1, padding: '2.5rem', maxWidth: '1100px', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>Submit PDF to Public Catalog</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.25rem' }}>
            Contribute open technical materials, slide decks, or tutorial notes. All uploads undergo binary validation and moderation.
          </p>
        </div>

        {/* Submission Form Card */}
        <section
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>New Contribution Form</h2>

          {successMessage && (
            <div style={{ padding: '0.85rem 1rem', background: 'var(--accent-success-light)', color: 'var(--accent-success)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 size={16} />
              <span>{successMessage}</span>
            </div>
          )}

          {validationError && (
            <div style={{ padding: '0.85rem 1rem', background: 'var(--accent-danger-light)', color: 'var(--accent-danger)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={16} />
              <span>{validationError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label htmlFor="contributionFileInput" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                PDF File (Binary %PDF- validated, up to 100 MB)
              </label>
              <input
                id="contributionFileInput"
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileSelect}
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            <div>
              <label htmlFor="contributionTitleInput" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                Document Title
              </label>
              <input
                id="contributionTitleInput"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="E.g. Distributed Consensus in Cloud Infrastructures"
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                }}
              />
            </div>

            <div>
              <label htmlFor="contributionDescInput" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                Summary / Description
              </label>
              <textarea
                id="contributionDescInput"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Key concepts, topics, or study syllabus covered..."
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label htmlFor="contributionCatsInput" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Categories (comma-separated)
                </label>
                <input
                  id="contributionCatsInput"
                  type="text"
                  value={categories}
                  onChange={(e) => setCategories(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.85rem',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <div>
                <label htmlFor="contributionTagsInput" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Tags / Keywords
                </label>
                <input
                  id="contributionTagsInput"
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.85rem',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
              <input
                type="checkbox"
                id="rightsCheck"
                checked={rightsDeclared}
                onChange={(e) => setRightsDeclared(e.target.checked)}
                required
                style={{ marginTop: '3px' }}
              />
              <label htmlFor="rightsCheck" style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                I warrant and declare that I possess the lawful rights or open-access permissions to submit and distribute this PDF document for community access under the documented Copyright Policy.
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                alignSelf: 'flex-start',
                padding: '0.7rem 1.5rem',
                background: 'var(--accent-primary)',
                color: '#fff',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 600,
                fontSize: '0.9rem',
                border: 'none',
              }}
            >
              {submitting ? 'Validating & Uploading...' : 'Submit to Moderation Queue'}
            </button>
          </form>
        </section>

        {/* Submissions Tracking List */}
        <section>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>My Submissions History</h2>
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
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{sub.title}</h3>
                    {getStatusBadge(sub.status)}
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {sub.file_name} &bull; {(sub.file_size / (1024 * 1024)).toFixed(1)} MB &bull; Submitted {new Date(sub.created_at).toLocaleDateString()}
                  </span>
                  {sub.rejection_reason && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--accent-danger)', marginTop: '0.25rem' }}>
                      Rejection Reason: {sub.rejection_reason}
                    </div>
                  )}
                </div>

                {sub.document_id && (
                  <Link
                    href={`/library/${sub.document_id}`}
                    style={{
                      fontSize: '0.825rem',
                      color: 'var(--accent-primary)',
                      fontWeight: 600,
                    }}
                  >
                    View in Catalog &rarr;
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
