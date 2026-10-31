'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  FileEdit,
  Plus,
  Download,
  Trash2,
  Link as LinkIcon,
  CheckCircle,
  Clock,
  AlertTriangle,
  Database,
  RefreshCw,
} from 'lucide-react';
import { localNotes, LocalNote } from '@/lib/storage/indexedDb';
import { api } from '@/lib/api/client';
import { TiptapEditor } from '../notes/TiptapEditor';
import styles from './NotesSplitPanel.module.css';

type SaveStatus = 'saved' | 'saving' | 'conflict';

interface NotesSplitPanelProps {
  documentId: string;
  documentTitle: string;
  currentPage: number;
  userId?: string;
  onJumpToPage: (page: number) => void;
  onClose: () => void;
}

export function NotesSplitPanel({
  documentId,
  documentTitle,
  currentPage,
  userId: propUserId,
  onJumpToPage,
  onClose,
}: NotesSplitPanelProps) {
  const [userId, setUserId] = useState<string>(propUserId || 'local_user');
  const [notes, setNotes] = useState<LocalNote[]>([]);
  const [activeNote, setActiveNote] = useState<LocalNote | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Obtain active user if not supplied
  useEffect(() => {
    if (propUserId) {
      setUserId(propUserId);
      return;
    }

    let isMounted = true;
    api.auth
      .getMe()
      .then((data) => {
        if (!isMounted) return;
        if (data.user?.id) {
          setUserId(data.user.id);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [propUserId]);

  // Load notes from local-first IndexedDB
  const reloadNotes = async (activeUserId: string) => {
    try {
      const list = await localNotes.list(activeUserId, documentId);
      setNotes(list);
      if (list.length > 0 && !activeNote) {
        setActiveNote(list[0]);
      }
    } catch (err) {
      console.error('Failed to load local notes:', err);
    }
  };

  useEffect(() => {
    reloadNotes(userId);
  }, [documentId, userId]);

  // Create new local note
  const handleCreateNote = async () => {
    try {
      const newNote = await localNotes.save(
        {
          document_id: documentId,
          page_number: currentPage,
          title: `Page ${currentPage} Note (${new Date().toLocaleDateString()})`,
          content_html: `<p>New local note attached to page ${currentPage}...</p>`,
        },
        userId
      );

      setNotes((prev) => [newNote, ...prev]);
      setActiveNote(newNote);
      setSaveStatus('saved');
    } catch (err: any) {
      alert(err.message || 'Failed to create local note');
    }
  };

  // Debounced local persistence on content change
  const handleContentChange = (html: string, json: any) => {
    if (!activeNote) return;

    setSaveStatus('saving');

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const updated = await localNotes.save(
          {
            ...activeNote,
            content_html: html,
            content_json: json,
          },
          userId
        );

        setActiveNote(updated);
        setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
        setSaveStatus(updated.sync_status === 'conflict' ? 'conflict' : 'saved');
      } catch (err) {
        console.error('Failed to save note locally:', err);
      }
    }, 400); // 400ms responsive local persistence
  };

  const handleTitleChange = (newTitle: string) => {
    if (!activeNote) return;
    const updated = { ...activeNote, title: newTitle };
    setActiveNote(updated);
    setNotes(notes.map((n) => (n.id === updated.id ? updated : n)));

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const saved = await localNotes.save(
          {
            ...activeNote,
            title: newTitle,
          },
          userId
        );
        setActiveNote(saved);
        setNotes((prev) => prev.map((n) => (n.id === saved.id ? saved : n)));
      } catch (err) {
        console.error('Failed to update note title locally:', err);
      }
    }, 400);
  };

  const handleDeleteNote = async (id: string) => {
    try {
      await localNotes.delete(id, userId);
      const remaining = notes.filter((n) => n.id !== id);
      setNotes(remaining);
      setActiveNote(remaining.length > 0 ? remaining[0] : null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete note');
    }
  };

  const handleKeepLocalVersion = async () => {
    if (!activeNote) return;
    const resolved: LocalNote = {
      ...activeNote,
      sync_status: 'dirty',
      conflict_data: null,
      version: (activeNote.version || 1) + 1,
    };
    const saved = await localNotes.save(resolved, userId);
    setActiveNote(saved);
    setNotes((prev) => prev.map((n) => (n.id === saved.id ? saved : n)));
    setSaveStatus('saved');
  };

  const handleAcceptServerVersion = async () => {
    if (!activeNote || !activeNote.conflict_data) return;
    const resolved: LocalNote = {
      ...activeNote,
      title: activeNote.conflict_data.server_title,
      content_html: activeNote.conflict_data.server_content_html,
      sync_status: 'synced',
      conflict_data: null,
    };
    const saved = await localNotes.save(resolved, userId);
    setActiveNote(saved);
    setNotes((prev) => prev.map((n) => (n.id === saved.id ? saved : n)));
    setSaveStatus('saved');
  };

  const handleExportMarkdown = () => {
    if (!activeNote) return;
    const markdown = `# ${activeNote.title}\n\nLinked to: ${documentTitle} (Page ${activeNote.page_number || 'N/A'})\nClient Updated: ${new Date(activeNote.client_updated_at).toLocaleString()}\nSync Status: ${activeNote.sync_status}\n\n${activeNote.content_html.replace(/<[^>]+>/g, '\n')}`;
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
                : styles.statusFailed
            }`}
            title="Saved locally in browser IndexedDB. Manually sync anytime via Header or Logout."
          >
            {saveStatus === 'saved' && (
              <>
                <Database size={10} /> Local
              </>
            )}
            {saveStatus === 'saving' && (
              <>
                <Clock size={10} /> Saving...
              </>
            )}
            {saveStatus === 'conflict' && (
              <>
                <AlertTriangle size={10} /> Conflict
              </>
            )}
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

      {/* Conflict Resolution Banner */}
      {activeNote?.conflict_data && (
        <div
          style={{
            padding: '0.65rem 0.85rem',
            background: 'rgba(234, 179, 8, 0.15)',
            borderBottom: '1px solid rgba(234, 179, 8, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
            fontSize: '0.785rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#eab308', fontWeight: 600 }}>
            <AlertTriangle size={14} />
            <span>Cloud Conflict Detected</span>
          </div>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
            This note was edited on another device. Choose which version to keep:
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
            <button
              type="button"
              onClick={handleKeepLocalVersion}
              style={{
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                background: 'var(--accent-primary)',
                color: '#fff',
                fontSize: '0.725rem',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Keep My Version
            </button>
            <button
              type="button"
              onClick={handleAcceptServerVersion}
              style={{
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                background: 'transparent',
                border: '1px solid var(--border-medium)',
                color: 'var(--text-primary)',
                fontSize: '0.725rem',
                cursor: 'pointer',
              }}
            >
              Use Server Version
            </button>
          </div>
        </div>
      )}

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
              background: 'none',
              border: 'none',
              cursor: 'pointer',
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
