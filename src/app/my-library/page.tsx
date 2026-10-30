'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  UploadCloud,
  FolderPlus,
  Trash2,
  Bookmark,
  FileText,
  X,
  RotateCcw,
  BookOpen,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { Document, Folder } from '@/lib/types/database';
import { validatePdfBuffer } from '@/lib/pdf/validator';
import { Sidebar } from '@/components/layout/Sidebar';
import { DocumentCard } from '@/components/library/DocumentCard';
import styles from './page.module.css';

export default function MyLibraryPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [trashDocs, setTrashDocs] = useState<Document[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'favorites' | 'folders' | 'trash'>('all');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Upload modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docTitle, setDocTitle] = useState('');
  const [docDescription, setDocDescription] = useState('');
  const [docCategories, setDocCategories] = useState('Computer Science');
  const [docTags, setDocTags] = useState('Study, Notes');
  const [isPublic, setIsPublic] = useState(false);
  const [rightsDeclared, setRightsDeclared] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // New folder modal
  const [newFolderName, setNewFolderName] = useState('');
  const [folderModalOpen, setFolderModalOpen] = useState(false);

  const reloadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [docsRes, foldersRes] = await Promise.all([
        api.documents.getMine({ limit: 100 }),
        api.folders.list(),
      ]);

      const allDocs = docsRes.documents || [];
      setDocuments(allDocs.filter((d) => !d.is_trash));
      setTrashDocs(allDocs.filter((d) => d.is_trash));
      setFolders(foldersRes.folders || []);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load library items.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadData();
  }, [reloadData]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setValidationError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    if (!docTitle) {
      setDocTitle(file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' '));
    }

    try {
      const buffer = await file.arrayBuffer();
      const validation = validatePdfBuffer(new Uint8Array(buffer));
      if (!validation.isValid) {
        setValidationError(validation.error || 'Invalid PDF file.');
      }
    } catch {
      setValidationError('Failed to inspect PDF binary structure.');
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setValidationError('Please select a PDF file to upload.');
      return;
    }
    if (!rightsDeclared) {
      setValidationError('You must confirm that you have rights to upload this file.');
      return;
    }

    setUploading(true);
    setValidationError(null);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const validation = validatePdfBuffer(new Uint8Array(buffer));

      if (!validation.isValid) {
        setValidationError(validation.error || 'PDF binary validation failed.');
        setUploading(false);
        return;
      }

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('title', docTitle.trim() || selectedFile.name);
      formData.append('description', docDescription.trim());
      formData.append('categories', docCategories);
      formData.append('tags', docTags);
      formData.append('is_public', String(isPublic));
      formData.append('rights_declared', String(rightsDeclared));

      await api.documents.upload(formData);

      setUploading(false);
      setUploadModalOpen(false);
      setSelectedFile(null);
      setDocTitle('');
      setDocDescription('');
      setRightsDeclared(false);
      await reloadData();
    } catch (err: any) {
      setValidationError(err.message || 'Error processing PDF upload.');
      setUploading(false);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newFolderName.trim()) {
      try {
        await api.folders.create({ name: newFolderName.trim() });
        setNewFolderName('');
        setFolderModalOpen(false);
        await reloadData();
      } catch (err: any) {
        alert(err.message || 'Failed to create folder');
      }
    }
  };

  const handleTrashDocument = async (id: string) => {
    try {
      await api.documents.delete(id, false);
      await reloadData();
    } catch (err: any) {
      alert(err.message || 'Failed to move document to trash');
    }
  };

  const handleRestoreDocument = async (id: string) => {
    try {
      await api.documents.update(id, { is_trash: false });
      await reloadData();
    } catch (err: any) {
      alert(err.message || 'Failed to restore document');
    }
  };

  const handleDeletePermanently = async (id: string) => {
    if (confirm('Permanently delete this PDF document? This action cannot be undone.')) {
      try {
        await api.documents.delete(id, true);
        await reloadData();
      } catch (err: any) {
        alert(err.message || 'Failed to permanently delete document');
      }
    }
  };

  const displayedDocs =
    activeTab === 'favorites'
      ? documents.filter((d) => d.is_favorite)
      : documents;

  return (
    <div className={styles.container}>
      <Sidebar counts={{ documents: documents.length, notes: 0, bookmarks: 0 }} />

      <main className={styles.mainContent}>
        <div className={styles.headerRow}>
          <div className={styles.titleArea}>
            <h1>Personal PDF Library</h1>
            <p>Upload private research papers, screenshot bundles, and study notebooks.</p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              className={styles.uploadBtn}
              onClick={() => setFolderModalOpen(true)}
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}
            >
              <FolderPlus size={16} />
              <span>New Folder</span>
            </button>

            <button
              type="button"
              className={styles.uploadBtn}
              onClick={() => setUploadModalOpen(true)}
            >
              <UploadCloud size={16} />
              <span>Upload PDF</span>
            </button>
          </div>
        </div>

        {errorMessage && (
          <div style={{ padding: '0.85rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={18} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className={styles.tabBar} role="tablist">
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'all' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('all')}
            role="tab"
            aria-selected={activeTab === 'all'}
          >
            All Uploads ({documents.length})
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'favorites' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('favorites')}
            role="tab"
            aria-selected={activeTab === 'favorites'}
          >
            Favorites ({documents.filter((d) => d.is_favorite).length})
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'folders' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('folders')}
            role="tab"
            aria-selected={activeTab === 'folders'}
          >
            Folders ({folders.length})
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'trash' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('trash')}
            role="tab"
            aria-selected={activeTab === 'trash'}
          >
            Trash ({trashDocs.length})
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader2 size={28} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
            <p>Loading your PDF documents...</p>
          </div>
        ) : activeTab === 'trash' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {trashDocs.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Trash is empty. Deleted items will be held here for recovery.
              </div>
            ) : (
              trashDocs.map((doc) => (
                <div key={doc.id} className={styles.trashCard}>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{doc.title}</h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Deleted on {new Date(doc.trashed_at || doc.updated_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => handleRestoreDocument(doc.id)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        padding: '0.4rem 0.75rem',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-medium)',
                        borderRadius: 'var(--radius-xs)',
                        color: 'var(--text-primary)',
                        fontSize: '0.8rem',
                      }}
                    >
                      <RotateCcw size={13} />
                      <span>Restore</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeletePermanently(doc.id)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        padding: '0.4rem 0.75rem',
                        background: 'var(--accent-danger)',
                        border: 'none',
                        borderRadius: 'var(--radius-xs)',
                        color: '#fff',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                      }}
                    >
                      <Trash2 size={13} />
                      <span>Delete Forever</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : activeTab === 'folders' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.25rem' }}>
            {folders.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No folders created yet. Click &quot;New Folder&quot; above to organize your documents.
              </div>
            ) : (
              folders.map((folder) => (
                <div
                  key={folder.id}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: `${folder.color}20`, color: folder.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FolderPlus size={18} />
                  </div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>{folder.name}</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{folder.document_count || 0} documents</span>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className={styles.docsGrid}>
            {displayedDocs.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', padding: '4rem 2rem', textAlign: 'center', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', color: 'var(--text-muted)' }}>
                <UploadCloud size={40} style={{ margin: '0 auto 1rem', display: 'block' }} />
                <h3>No Documents Found</h3>
                <p style={{ marginTop: '0.5rem' }}>Click &quot;Upload PDF&quot; above to add technical materials to your library.</p>
              </div>
            ) : (
              displayedDocs.map((doc) => (
                <div key={doc.id} style={{ position: 'relative' }}>
                  <DocumentCard document={doc} />
                  <button
                    type="button"
                    onClick={() => handleTrashDocument(doc.id)}
                    style={{
                      position: 'absolute',
                      top: '0.75rem',
                      right: '0.75rem',
                      background: 'rgba(15, 23, 42, 0.75)',
                      backdropFilter: 'blur(4px)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-xs)',
                      color: 'var(--text-muted)',
                      padding: '0.25rem 0.45rem',
                      cursor: 'pointer',
                      zIndex: 10,
                    }}
                    title="Move to Trash"
                    aria-label="Move document to trash"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Upload Modal */}
        {uploadModalOpen && (
          <div className={styles.modalBackdrop}>
            <div className={styles.modalCard}>
              <div className={styles.modalHeader}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Upload PDF Document
                </h2>
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  style={{ color: 'var(--text-muted)' }}
                  aria-label="Close upload modal"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <label className={styles.fileDropzone}>
                  <UploadCloud size={32} color="var(--accent-primary)" />
                  <div>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {selectedFile ? selectedFile.name : 'Choose a PDF file or drag here'}
                    </span>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      Binary %PDF- header validated. Up to 100 MB.
                    </p>
                  </div>
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                </label>

                {validationError && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', background: 'var(--accent-danger-light)', borderRadius: 'var(--radius-sm)', color: 'var(--accent-danger)', fontSize: '0.85rem' }}>
                    <AlertCircle size={16} />
                    <span>{validationError}</span>
                  </div>
                )}

                <div className={styles.inputGroup}>
                  <label htmlFor="modalDocTitle" className={styles.inputLabel}>Document Title</label>
                  <input
                    id="modalDocTitle"
                    type="text"
                    required
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    placeholder="E.g. Database Internals & Index Structures"
                    className={styles.textInput}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label htmlFor="modalDocDesc" className={styles.inputLabel}>Description</label>
                  <textarea
                    id="modalDocDesc"
                    rows={3}
                    value={docDescription}
                    onChange={(e) => setDocDescription(e.target.value)}
                    placeholder="Brief summary of document topics..."
                    className={styles.textInput}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label htmlFor="modalDocCats" className={styles.inputLabel}>Categories (comma-separated)</label>
                  <input
                    id="modalDocCats"
                    type="text"
                    value={docCategories}
                    onChange={(e) => setDocCategories(e.target.value)}
                    className={styles.textInput}
                  />
                </div>

                <div className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    id="isPublicCheck"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                  />
                  <label htmlFor="isPublicCheck">
                    Submit to Public Library (requires community moderation approval before publication)
                  </label>
                </div>

                <div className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    id="rightsDeclaredCheck"
                    checked={rightsDeclared}
                    onChange={(e) => setRightsDeclared(e.target.checked)}
                    required
                  />
                  <label htmlFor="rightsDeclaredCheck">
                    I confirm that I possess the rights to store or distribute this document.
                  </label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setUploadModalOpen(false)}
                    style={{ padding: '0.55rem 1rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading}
                    style={{ padding: '0.55rem 1.25rem', background: 'var(--accent-primary)', border: 'none', borderRadius: 'var(--radius-sm)', color: '#fff', fontWeight: 600 }}
                  >
                    {uploading ? 'Validating & Uploading...' : 'Upload PDF'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* New Folder Modal */}
        {folderModalOpen && (
          <div className={styles.modalBackdrop}>
            <div className={styles.modalCard} style={{ maxWidth: '400px' }}>
              <div className={styles.modalHeader}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Create New Folder</h3>
                <button type="button" onClick={() => setFolderModalOpen(false)} style={{ color: 'var(--text-muted)' }}>
                  <X size={16} />
                </button>
              </div>
              <form onSubmit={handleCreateFolder} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className={styles.inputGroup}>
                  <label htmlFor="modalFolderName" className={styles.inputLabel}>Folder Name</label>
                  <input
                    id="modalFolderName"
                    type="text"
                    required
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="E.g. Compilers, OS, Networking"
                    className={styles.textInput}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                  <button type="button" onClick={() => setFolderModalOpen(false)} style={{ padding: '0.5rem 1rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }}>
                    Cancel
                  </button>
                  <button type="submit" style={{ padding: '0.5rem 1rem', background: 'var(--accent-primary)', color: '#fff', borderRadius: 'var(--radius-sm)', fontWeight: 600 }}>
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
