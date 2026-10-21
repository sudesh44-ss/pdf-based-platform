'use client';

import React from 'react';
import { X, FileText } from 'lucide-react';
import styles from './ThumbnailDrawer.module.css';

interface ThumbnailDrawerProps {
  totalPages: number;
  currentPage: number;
  onPageSelect: (page: number) => void;
  onClose: () => void;
}

export function ThumbnailDrawer({
  totalPages,
  currentPage,
  onPageSelect,
  onClose,
}: ThumbnailDrawerProps) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <aside className={styles.drawer} aria-label="Page Thumbnails">
      <div className={styles.header}>
        <span>Pages ({totalPages})</span>
        <button
          type="button"
          onClick={onClose}
          className={styles.closeBtn}
          title="Close thumbnails"
          aria-label="Close thumbnails"
        >
          <X size={16} />
        </button>
      </div>

      <div className={styles.thumbnailList}>
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            className={`${styles.thumbItem} ${p === currentPage ? styles.thumbItemActive : ''}`}
            onClick={() => onPageSelect(p)}
          >
            <div className={styles.thumbPreview}>
              <FileText size={20} />
              <span style={{ fontSize: '0.7rem', marginTop: '0.25rem' }}>Page {p}</span>
            </div>
            <span className={styles.pageNumber}>{p}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
