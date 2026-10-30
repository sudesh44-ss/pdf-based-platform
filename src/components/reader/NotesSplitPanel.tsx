'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  FileEdit,
  Plus,
  Download,
  Share2,
  Trash2,
  Link as LinkIcon,
  CheckCircle,
  Clock,
  AlertCircle,
  WifiOff,
} from 'lucide-react';
import { Note } from '@/lib/types/database';
import { api } from '@/lib/api/client';
import { TiptapEditor } from '../notes/TiptapEditor';
import styles from './NotesSplitPanel.module.css';

type SaveStatus = 'saving' | 'saved' | 'offline' | 'failed';

interface NotesSplitPanelProps {
  documentId: string;
  documentTitle: string;
  currentPage: number;
  onJumpToPage: (page: number) => void;
  onClose: () => void;
}

export function NotesSplitPanel({
  documentId,
  documentTitle,
  currentPage,
  onJumpToPage,
  onClose,
}: NotesSplitPanelProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let isMounted = true;
    api.notes
      .list({ document_id: documentId })
      .then((res) => {
        if (!isMounted) return;
        const list = res.notes || [];
        setNotes(list);
        if (list.length > 0) {
          setActiveNote(list[0]);
        }
      })
      .catch((err) => {
        console.error('Error fetching document notes:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [documentId, documentTitle, currentPage]);

  const handleCreateNote = async () => {
    try {
      const newNote = await api.notes.create({
        document_id: documentId,
        page_number: currentPage,
        title: `Page ${currentPage} Note (${new Date().toLocaleDateString()})`,
        content_html: `<p>New note attached to page ${currentPage}...</p>`,
      });
      setNotes([newNote, ...notes]);
      setActiveNote(newNote);
      setSaveStatus('saved');
    } catch (err: any) {
      alert(err.message || 'Failed to create note');
    }
  };

  const handleContentChange = (html: string, json: any) => {
    if (!activeNote) return;

    setSaveStatus('saving');

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce auto-save by 800ms
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const updated = await api.notes.update(activeNote.id, {
          content_html: html,
          content_json: json,
        });
        setActiveNote(updated);
        setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
        setSaveStatus('saved');
      } catch (err) {
        setSaveStatus('failed');
      }
    }, 800);
  };

  const handleTitleChange = (newTitle: string) => {
    if (!activeNote) return;
    const updated = { ...activeNote, title: newTitle };
    setActiveNote(updated);
    setNotes(notes.map((n) => (n.id === updated.id ? updated : n)));

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await api.notes.update(activeNote.id, { title: newTitle });
      } catch {
        // Ignore
      }
    }, 800);
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
    const markdown = `# ${activeNote.title}\n\nLinked to: ${documentTitle} (Page ${activeNote.page_number})\nDate: ${new Date(activeNote.updated_at).toLocaleString()}\n\n${activeNote.content_html.replace(/<[^>]+>/g, '\n')}`;
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeNote.title.toLowerCase().replace(/\s+/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <aside className={styles.panel} aria-label="Study Notes Split Panel">
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <FileEdit size={16} color="var(--accent-primary)" />
          <span>Study Notes</span>
          <span
            className={`${styles.statusBadge} ${
              saveStatus === 'saved'
                ? styles.statusSaved
                : saveStatus === 'saving'
                ? styles.statusSaving
                : saveStatus === 'offline'
                ? styles.statusOffline
                : styles.statusFailed
            }`}
          >
            {saveStatus === 'saved' && <><CheckCircle size={10} /> Saved</>}
            {saveStatus === 'saving' && <><Clock size={10} /> Saving...</>}
            {saveStatus === 'offline' && <><WifiOff size={10} /> Offline</>}
            {saveStatus === 'failed' && <><AlertCircle size={10} /> Save Failed</>}
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className={styles.actionBtn}
          title="Close Notes Panel"
          aria-label="Close Notes Panel"
        >
          <X size={16} />
        </button>
      </div>

      <div className={styles.noteSelectRow}>
        {activeNote ? (
          <input
            type="text"
            className={styles.noteTitleInput}
            value={activeNote.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Note title..."
          />
        ) : (
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No active note</span>
        )}

        <button
          type="button"
          className={styles.newNoteBtn}
          onClick={handleCreateNote}
          title="Add another note to this document"
        >
          <Plus size={13} />
          <span>New</span>
        </button>
      </div>

      {activeNote?.page_number && (
        <div
          style={{
            padding: '0.4rem 1rem',
            background: 'var(--bg-secondary)',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <LinkIcon size={12} color="var(--accent-primary)" />
          <span>Linked to Page {activeNote.page_number}</span>
          <button
            type="button"
            onClick={() => onJumpToPage(activeNote.page_number!)}
            style={{
              marginLeft: 'auto',
              color: 'var(--accent-primary)',
              textDecoration: 'underline',
              fontSize: '0.75rem',
            }}
          >
            Jump to page
          </button>
        </div>
      )}

      <div className={styles.editorArea}>
        {activeNote ? (
          <TiptapEditor
            key={activeNote.id}
            initialContent={activeNote.content_html}
            onChange={handleContentChange}
          />
        ) : (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Click &quot;New&quot; to create a note.
          </div>
        )}
      </div>

      <div className={styles.footerActions}>
        <button
          type="button"
          className={styles.actionBtn}
          onClick={handleExportMarkdown}
          disabled={!activeNote}
          title="Export current note to Markdown (.md)"
        >
          <Download size={13} />
          <span>Export Markdown</span>
        </button>

        {activeNote && (
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => handleDeleteNote(activeNote.id)}
            style={{ color: 'var(--accent-danger)' }}
            title="Delete this note"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </aside>
  );
}
