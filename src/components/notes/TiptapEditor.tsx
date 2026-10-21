'use client';

import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Code,
  Quote,
  Undo,
  Redo,
} from 'lucide-react';
import styles from './TiptapEditor.module.css';

interface TiptapEditorProps {
  initialContent?: string;
  onChange?: (html: string, json: any) => void;
  placeholder?: string;
  readOnly?: boolean;
}

export function TiptapEditor({
  initialContent = '',
  onChange,
  readOnly = false,
}: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
    ],
    content: initialContent,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      if (onChange) {
        onChange(editor.getHTML(), editor.getJSON());
      }
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (editor && initialContent !== undefined && editor.getHTML() !== initialContent) {
      editor.commands.setContent(initialContent);
    }
  }, [initialContent, editor]);

  if (!editor) {
    return <div style={{ padding: '1rem', color: 'var(--text-muted)' }}>Initializing rich-text editor...</div>;
  }

  return (
    <div className={styles.editorContainer}>
      {!readOnly && (
        <div className={styles.toolbar} role="toolbar" aria-label="Editor formatting toolbar">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`${styles.btn} ${editor.isActive('bold') ? styles.active : ''}`}
            title="Bold (Ctrl+B)"
            aria-label="Bold"
          >
            <Bold size={14} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`${styles.btn} ${editor.isActive('italic') ? styles.active : ''}`}
            title="Italic (Ctrl+I)"
            aria-label="Italic"
          >
            <Italic size={14} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`${styles.btn} ${editor.isActive('strike') ? styles.active : ''}`}
            title="Strikethrough"
            aria-label="Strikethrough"
          >
            <Strikethrough size={14} />
          </button>

          <div className={styles.divider} />

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`${styles.btn} ${editor.isActive('heading', { level: 1 }) ? styles.active : ''}`}
            title="Heading 1"
            aria-label="Heading 1"
          >
            <Heading1 size={14} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`${styles.btn} ${editor.isActive('heading', { level: 2 }) ? styles.active : ''}`}
            title="Heading 2"
            aria-label="Heading 2"
          >
            <Heading2 size={14} />
          </button>

          <div className={styles.divider} />

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`${styles.btn} ${editor.isActive('bulletList') ? styles.active : ''}`}
            title="Bullet List"
            aria-label="Bullet List"
          >
            <List size={14} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`${styles.btn} ${editor.isActive('orderedList') ? styles.active : ''}`}
            title="Numbered List"
            aria-label="Numbered List"
          >
            <ListOrdered size={14} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={`${styles.btn} ${editor.isActive('codeBlock') ? styles.active : ''}`}
            title="Code Block"
            aria-label="Code Block"
          >
            <Code size={14} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`${styles.btn} ${editor.isActive('blockquote') ? styles.active : ''}`}
            title="Blockquote"
            aria-label="Blockquote"
          >
            <Quote size={14} />
          </button>

          <div className={styles.divider} />

          <button
            type="button"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className={styles.btn}
            title="Undo"
            aria-label="Undo"
          >
            <Undo size={14} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className={styles.btn}
            title="Redo"
            aria-label="Redo"
          >
            <Redo size={14} />
          </button>
        </div>
      )}

      <div className={styles.editorContent}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
