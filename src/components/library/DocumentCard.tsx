'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { FileText, Heart, Calendar, BookOpen, Layers, User } from 'lucide-react';
import { Document } from '@/lib/types/database';
import { storageEngine } from '@/lib/store/storageEngine';
import styles from './DocumentCard.module.css';

interface DocumentCardProps {
  document: Document;
  onLikeToggle?: (id: string, isLiked: boolean, count: number) => void;
}

export function DocumentCard({ document: initialDoc, onLikeToggle }: DocumentCardProps) {
  const [doc, setDoc] = useState(initialDoc);

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${Math.round(bytes / 1024)} KB`;
  };

  const formatDate = (isoStr: string) => {
    try {
      return new Date(isoStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'Recently';
    }
  };

  const handleLike = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const result = storageEngine.toggleLike(doc.id);
    setDoc({
      ...doc,
      is_liked: result.isLiked,
      likes_count: result.likesCount,
    });
    if (onLikeToggle) {
      onLikeToggle(doc.id, result.isLiked, result.likesCount);
    }
  };

  return (
    <div className={styles.card}>
      <Link href={`/library/${doc.id}`} className={styles.thumbnailWrapper}>
        <div className={styles.pdfWatermark}>
          <FileText size={38} />
          <span>{doc.page_count} PAGES</span>
        </div>
        <div className={styles.badgeGroup}>
          {doc.categories.slice(0, 2).map((cat) => (
            <span key={cat} className={styles.categoryBadge}>{cat}</span>
          ))}
        </div>
      </Link>

      <div className={styles.content}>
        <Link href={`/library/${doc.id}`}>
          <h3 className={styles.title} title={doc.title}>{doc.title}</h3>
        </Link>
        {doc.description && (
          <p className={styles.description}>{doc.description}</p>
        )}

        <div className={styles.tagsRow}>
          {doc.tags.slice(0, 3).map((t) => (
            <span key={t} className={styles.tag}>#{t}</span>
          ))}
        </div>

        <div className={styles.metaRow}>
          <div className={styles.metaItem} title="Page count">
            <Layers size={13} />
            <span>{doc.page_count}p</span>
          </div>
          <div className={styles.metaItem} title="File size">
            <FileText size={13} />
            <span>{formatFileSize(doc.file_size)}</span>
          </div>
          <div className={styles.metaItem} title="Upload date">
            <Calendar size={13} />
            <span>{formatDate(doc.created_at)}</span>
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.contributor} title={`Uploaded by ${doc.contributor_name || 'Anonymous'}`}>
          <User size={13} />
          <span>{doc.contributor_name || 'Community'}</span>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.likeBtn} ${doc.is_liked ? styles.liked : ''}`}
            onClick={handleLike}
            aria-label="Like document"
            title="Like this PDF"
          >
            <Heart size={14} fill={doc.is_liked ? 'currentColor' : 'none'} />
            <span>{doc.likes_count}</span>
          </button>

          <Link href={`/reader/${doc.id}`} className={styles.readBtn}>
            <BookOpen size={13} />
            <span>Read</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
