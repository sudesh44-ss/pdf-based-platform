'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  BookMarked,
  Plus,
  Trash2,
  FolderOpen,
  X,
  FileText,
  Star,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { Notebook } from '@/lib/types/database';
import { Sidebar } from '@/components/layout/Sidebar';

export default function NotebooksPage() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newColor, setNewColor] = useState('#8b5cf6');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.notebooks.list();
      setNotebooks(res.notebooks || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load notebooks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newTitle.trim()) {
      try {
        await api.notebooks.create({
          title: newTitle.trim(),
          description: newDesc.trim(),
          color: newColor,
        });
        setNewTitle('');
        setNewDesc('');
        setIsModalOpen(false);
        await reload();
      } catch (err: any) {
        alert(err.message || 'Failed to create notebook');
      }
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm('Delete this notebook? Notes inside will be preserved as unassigned.')) {
      try {
        await api.notebooks.delete(id);
        await reload();
      } catch (err: any) {
        alert(err.message || 'Failed to delete notebook');
      }
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - var(--header-height))', width: '100%' }}>
      <Sidebar />

      <main style={{ flex: 1, padding: '2.5rem', maxWidth: '1200px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>Independent Notebooks</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.25rem' }}>
              Curate multi-subject engineering notebooks independent of specific PDF files.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.6rem 1.15rem',
              background: 'var(--accent-primary)',
              color: '#fff',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            <Plus size={16} />
            <span>Create Notebook</span>
          </button>
        </div>

        {error && (
          <div style={{ padding: '0.85rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader2 size={28} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
            <p>Loading notebooks...</p>
          </div>
        ) : notebooks.length === 0 ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', color: 'var(--text-muted)' }}>
            <BookMarked size={40} style={{ margin: '0 auto 1rem', display: 'block' }} />
            <h3>No Notebooks Found</h3>
            <p style={{ marginTop: '0.5rem' }}>Click &quot;Create Notebook&quot; above to start categorizing your engineering notes.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {notebooks.map((nb) => (
              <div
                key={nb.id}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                  borderTop: `4px solid ${nb.color}`,
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Created on {new Date(nb.created_at).toLocaleDateString()}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {nb.is_favorite && <Star size={15} fill="#f59e0b" color="#f59e0b" />}
                    <button
                      type="button"
                      onClick={(e) => handleDelete(nb.id, e)}
                      title="Delete notebook"
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{nb.title}</h2>
                {nb.description && (
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {nb.description}
                  </p>
                )}

                <div style={{ marginTop: 'auto', paddingTop: '0.85rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <FileText size={14} />
                    <span>{nb.note_count || 0} entries</span>
                  </span>

                  <Link
                    href={`/notes?notebook_id=${nb.id}`}
                    style={{
                      fontSize: '0.825rem',
                      color: 'var(--accent-primary)',
                      fontWeight: 600,
                    }}
                  >
                    Open Notebook &rarr;
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Modal */}
        {isModalOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'var(--bg-overlay)',
              backdropFilter: 'blur(6px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100,
              padding: '1.5rem',
            }}
          >
            <div
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-lg)',
                maxWidth: '440px',
                width: '100%',
                padding: '1.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>New Notebook</h3>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ color: 'var(--text-muted)' }}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label htmlFor="notebookTitleInput" style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                    Title
                  </label>
                  <input
                    id="notebookTitleInput"
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="E.g. Distributed Consensus Systems"
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
                  <label htmlFor="notebookDescInput" style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                    Description
                  </label>
                  <textarea
                    id="notebookDescInput"
                    rows={3}
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Topic overview..."
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
                  <label htmlFor="notebookColorSelect" style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                    Color Accent
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewColor(c)}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: c,
                          border: newColor === c ? '3px solid #fff' : 'none',
                          cursor: 'pointer',
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    style={{ padding: '0.5rem 1rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{ padding: '0.5rem 1.25rem', background: 'var(--accent-primary)', color: '#fff', borderRadius: 'var(--radius-sm)', fontWeight: 600 }}
                  >
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
