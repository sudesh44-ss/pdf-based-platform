'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Send,
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
      <Sidebar counts={{ documents: documents.length, bookmarks: 0 }} />

      <main className={styles.mainContent}>
        <div className={styles.headerRow}>
          <div className={styles.titleArea}>
            <h1>Personal PDF Library</h1>
            <p>Upload private research papers, documents, and reference PDFs.</p>
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

            <Link
              href="/my-contributions"
              className={styles.uploadBtn}
              style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Send size={16} />
              <span>Submit via Telegram</span>
            </Link>
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
                <FileText size={40} style={{ margin: '0 auto 1rem', display: 'block', opacity: 0.5 }} />
                <h3 style={{ color: 'var(--text-primary)' }}>No Documents Found</h3>
                <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
                  Submit technical materials via our Telegram group for admin review and publication.
                </p>
                <Link
                  href="/my-contributions"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    marginTop: '1rem',
                    padding: '0.55rem 1rem',
                    background: 'var(--accent-primary)',
                    color: '#fff',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  <Send size={14} />
                  <span>Submit via Telegram</span>
                </Link>
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
