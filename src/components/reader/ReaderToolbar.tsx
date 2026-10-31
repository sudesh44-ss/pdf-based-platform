'use client';

import React from 'react';
import Link from 'next/link';
import { ViewMode } from '@/lib/types/database';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Crop,
  Code2,
  Bookmark,
  FileText,
  Sidebar as SidebarIcon,
  RotateCcw,
  Rows3,
  Square,
} from 'lucide-react';
import styles from './ReaderToolbar.module.css';

interface ReaderToolbarProps {
  title: string;
  currentPage: number;
  totalPages: number;
  zoom: number;
  viewMode: ViewMode;
  isSmartCrop: boolean;
  isBookmarked: boolean;
  notesOpen?: boolean;
  thumbnailsOpen: boolean;
  isFullscreen: boolean;
  onPageChange: (page: number) => void;
  onZoomChange: (newZoom: number) => void;
  onFitWidth: () => void;
  onFitPage: () => void;
  onToggleViewMode: () => void;
  onToggleSmartCrop: () => void;
  onOpenCodeFocus: () => void;
  onToggleBookmark: () => void;
  onToggleNotes?: () => void;
  onToggleThumbnails: () => void;
  onToggleFullscreen: () => void;
}

function ReaderToolbarComponent({
  title,
  currentPage,
  totalPages,
  zoom,
  viewMode,
  isSmartCrop,
  isBookmarked,
  notesOpen = false,
  thumbnailsOpen,
  isFullscreen,
  onPageChange,
  onZoomChange,
  onFitWidth,
  onFitPage,
  onToggleViewMode,
  onToggleSmartCrop,
  onOpenCodeFocus,
  onToggleBookmark,
  onToggleNotes,
  onToggleThumbnails,
  onToggleFullscreen,
}: ReaderToolbarProps) {
  const handlePageInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 1 && val <= totalPages) {
      onPageChange(val);
    }
  };

  return (
    <div className={styles.toolbar} role="toolbar" aria-label="PDF Reader Toolbar">
      <div className={styles.leftGroup}>
        <Link href="/library" className={styles.backBtn} title="Return to Library">
          <ArrowLeft size={18} />
        </Link>
        <button
          type="button"
          className={`${styles.toolBtn} ${thumbnailsOpen ? styles.toolBtnActive : ''}`}
          onClick={onToggleThumbnails}
          title="Toggle Page Thumbnails (T)"
        >
          <SidebarIcon size={17} />
        </button>
        <span className={styles.docTitle} title={title}>{title}</span>
      </div>

      <div className={styles.centerGroup}>
        <button
          type="button"
          className={styles.toolBtn}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          title="Previous Page (Left Arrow)"
        >
          <ChevronLeft size={18} />
        </button>

        <div className={styles.pageInputWrapper}>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={currentPage}
            onChange={handlePageInput}
            className={styles.pageInput}
            aria-label="Current page number"
          />
          <span>/ {totalPages}</span>
        </div>

        <button
          type="button"
          className={styles.toolBtn}
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          title="Next Page (Right Arrow)"
        >
          <ChevronRight size={18} />
        </button>

        <div className={styles.divider} />

        <button
          type="button"
          className={styles.toolBtn}
          onClick={() => onZoomChange(Math.max(0.4, Math.round((zoom - 0.15) * 100) / 100))}
          title="Zoom Out (-)"
        >
          <ZoomOut size={16} />
        </button>

        <span className={styles.zoomText}>{Math.round(zoom * 100)}%</span>

        <button
          type="button"
          className={styles.toolBtn}
          onClick={() => onZoomChange(Math.min(3.0, Math.round((zoom + 0.15) * 100) / 100))}
          title="Zoom In (+)"
        >
          <ZoomIn size={16} />
        </button>

        <button
          type="button"
          className={styles.toolBtn}
          onClick={onFitWidth}
          title="Fit to Width"
        >
          <Rows3 size={15} />
        </button>

        <button
          type="button"
          className={styles.toolBtn}
          onClick={onFitPage}
          title="Fit to Page"
        >
          <Square size={15} />
        </button>

        <div className={styles.divider} />

        {/* Smart Crop View Toggle */}
        <button
          type="button"
          className={`${styles.toolBtn} ${isSmartCrop ? styles.badgeActive : ''}`}
          onClick={onToggleSmartCrop}
          title="Smart Screenshot Crop Mode (C)"
        >
          <Crop size={16} />
        </button>

        {/* Code Focus Mode Button */}
        <button
          type="button"
          className={styles.toolBtn}
          onClick={onOpenCodeFocus}
          title="Code Focus Mode (Inspect Code Editor / Terminal)"
        >
          <Code2 size={16} />
        </button>

        {/* Bookmark Button */}
        <button
          type="button"
          className={`${styles.toolBtn} ${isBookmarked ? styles.toolBtnActive : ''}`}
          onClick={onToggleBookmark}
          title="Bookmark Current Page (B)"
        >
          <Bookmark size={16} fill={isBookmarked ? 'currentColor' : 'none'} />
        </button>

        {/* Study Notes Split Panel Toggle */}
        {onToggleNotes && (
          <button
            type="button"
            className={`${styles.toolBtn} ${notesOpen ? styles.toolBtnActive : ''}`}
            onClick={onToggleNotes}
            title="Toggle Study Notes (N)"
            aria-label="Toggle Study Notes"
          >
            <FileText size={16} />
          </button>
        )}
      </div>

      <div className={styles.rightGroup}>
        <button
          type="button"
          className={styles.toolBtn}
          onClick={onToggleFullscreen}
          title="Toggle Fullscreen (F)"
        >
          {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
        </button>
      </div>
    </div>
  );
}

export const ReaderToolbar = React.memo(ReaderToolbarComponent);
