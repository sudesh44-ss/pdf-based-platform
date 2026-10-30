'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  FileText,
  Plus,
  Search,
  BookOpen,
  Download,
  Trash2,
  ExternalLink,
  CheckCircle,
  Clock,
  Bookmark,
  Loader2,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { Note } from '@/lib/types/database';
import { Sidebar } from '@/components/layout/Sidebar';
import { TiptapEditor } from '@/components/notes/TiptapEditor';
import styles from './page.module.css';

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [search, setSearch] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [loading, setLoading] = useState(true);

  const debounceTimerRef = useRef<any>(null);

  const reloadNotes = useCallback(async () => {
    try {
      const res = await api.notes.list({ q: search });
      const list = res.notes || [];
      setNotes(list);
      setActiveNote((prev) => {
        if (!prev && list.length > 0) return list[0];
        if (prev) {
          const found = list.find((n) => n.id === prev.id);
          return found || (list.length > 0 ? list[0] : null);
        }
        return null;
      });
    } catch (err) {
      console.error('Error loading notes:', err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    reloadNotes();
  }, [reloadNotes]);

  const handleCreateNote = async () => {
    try {
      const newNote = await api.notes.create({
        title: 'New Study Note',
        content_html: '<p>Start typing technical notes, architecture patterns, or snippets...</p>',
      });
      setNotes([newNote, ...notes]);
      setActiveNote(newNote);
    } catch (err: any) {
      alert(err.message || 'Failed to create note');
    }
  };

  const handleTitleChange = (newTitle: string) => {
    if (!activeNote) return;
    const updated = { ...activeNote, title: newTitle };
    setActiveNote(updated);
    setNotes(notes.map((n) => (n.id === updated.id ? updated : n)));

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        await api.notes.update(activeNote.id, { title: newTitle });
      } catch (err) {
        console.error('Error auto-saving note title:', err);
      }
    }, 600);
  };

  const handleContentChange = (html: string, json: any) => {
    if (!activeNote) return;
    setSaveStatus('saving');

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const updated = await api.notes.update(activeNote.id, {
          content_html: html,
          content_json: json,
        });
        setActiveNote(updated);
        setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
        setSaveStatus('saved');
      } catch (err) {
        console.error('Error saving note content:', err);
        setSaveStatus('saved');
      }
    }, 600);
  };

  const handleDeleteNote = async (id: string) => {
    try {
      await api.notes.delete(id);
      const remaining = notes.filter((n) => n.id !== id);
      setNotes(remaining);
      setActiveNote(remaining.length > 0 ? remaining[0] : null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete note');
    }
  };

  const handleExportMarkdown = () => {
    if (!activeNote) return;
    const markdown = `# ${activeNote.title}\n\nDate: ${new Date(activeNote.updated_at).toLocaleString()}\n\n${activeNote.content_html.replace(/<[^>]+>/g, '\n')}`;
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeNote.title.toLowerCase().replace(/\s+/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.container}>
      <Sidebar counts={{ documents: 0, notes: notes.length, bookmarks: 0 }} />

      <main className={styles.mainContent}>
        {/* Left List of Notes */}
        <div className={styles.notesSidebar}>
          <div className={styles.sidebarHeader}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Notes ({notes.length})</h2>
            <button
              type="button"
              onClick={handleCreateNote}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.35rem 0.65rem',
                background: 'var(--accent-primary)',
                color: '#fff',
                borderRadius: 'var(--radius-xs)',
                fontSize: '0.78rem',
                fontWeight: 600,
              }}
            >
              <Plus size={14} />
              <span>New Note</span>
            </button>
          </div>

          <div className={styles.searchBox}>
            <input
              type="search"
              placeholder="Search notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Loader2 size={20} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
              <span>Loading notes...</span>
            </div>
          ) : notes.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No notes found. Click &quot;New Note&quot; to begin.
            </div>
          ) : (
            <div className={styles.notesList}>
              {notes.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={`${styles.noteCard} ${activeNote?.id === n.id ? styles.noteCardActive : ''}`}
                  onClick={() => setActiveNote(n)}
                >
                  <div className={styles.noteCardTitle}>{n.title}</div>
                  <div className={styles.noteCardSnippet}>
                    {n.content_html.replace(/<[^>]+>/g, ' ') || 'Empty note...'}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{new Date(n.updated_at).toLocaleDateString()}</span>
                    {n.page_number && <span>Page {n.page_number}</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Editor Area */}
        <div className={styles.editorPane}>
          {activeNote ? (
            <>
              <div className={styles.editorHeader}>
                <input
                  type="text"
                  value={activeNote.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className={styles.titleInput}
                  placeholder="Note title..."
                />

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    {saveStatus === 'saved' ? <><CheckCircle size={13} color="var(--accent-success)" /> Saved</> : <><Clock size={13} /> Saving...</>}
                  </span>

                  <button
                    type="button"
                    onClick={handleExportMarkdown}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.45rem 0.85rem',
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.8rem',
                      color: 'var(--text-primary)',
                    }}
                    title="Export Markdown file"
                  >
                    <Download size={14} />
                    <span>Markdown</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteNote(activeNote.id)}
                    style={{
                      padding: '0.45rem',
                      color: 'var(--accent-danger)',
                      background: 'transparent',
                    }}
                    title="Delete Note"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {activeNote.document_id && (
                <div
                  style={{
                    padding: '0.6rem 0.85rem',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.825rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)' }}>
                    Linked to: <strong>{activeNote.document_title || 'Document'}</strong> {activeNote.page_number && `(Page ${activeNote.page_number})`}
                  </span>
                  <Link
                    href={`/reader/${activeNote.document_id}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      color: 'var(--accent-primary)',
                      fontWeight: 600,
                    }}
                  >
                    <span>Open in Reader</span>
                    <ExternalLink size={12} />
                  </Link>
                </div>
              )}

              <div style={{ flex: 1, minHeight: '350px' }}>
                <TiptapEditor
                  key={activeNote.id}
                  initialContent={activeNote.content_html}
                  onChange={handleContentChange}
                />
              </div>
            </>
          ) : (
            <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Select a note or click &quot;New Note&quot; to begin writing.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
