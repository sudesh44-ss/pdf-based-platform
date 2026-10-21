'use client';

import React, { useState } from 'react';
import { Code2, X, ZoomIn, ZoomOut, Eye, Info } from 'lucide-react';
import styles from './CodeFocusModal.module.css';

interface CodeFocusModalProps {
  canvasElement: HTMLCanvasElement | null;
  onClose: () => void;
}

export function CodeFocusModal({ canvasElement, onClose }: CodeFocusModalProps) {
  const [zoom, setZoom] = useState(1.8);
  const [filterMode, setFilterMode] = useState<'standard' | 'contrast' | 'dark' | 'sharpen'>('contrast');
  const [region, setRegion] = useState<'full' | 'top' | 'bottom'>('top');

  const getFilterClass = () => {
    if (filterMode === 'contrast') return styles.highContrastFilter;
    if (filterMode === 'dark') return styles.editorInvertFilter;
    if (filterMode === 'sharpen') return styles.sharpenFilter;
    return '';
  };

  return (
    <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label="Code Focus Mode">
      <div className={styles.modalHeader}>
        <div className={styles.titleArea}>
          <Code2 size={20} color="var(--accent-primary)" />
          <span>Code Focus Mode — Screenshot Inspector</span>
        </div>

        <div className={styles.controlsRow}>
          <label htmlFor="regionFocusSelect" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Region:</label>
          <select
            id="regionFocusSelect"
            className={styles.filterSelect}
            value={region}
            onChange={(e) => setRegion(e.target.value as any)}
            aria-label="Focus Region"
          >
            <option value="top">Top Half (Code Editor)</option>
            <option value="bottom">Bottom Half (Terminal / Output)</option>
            <option value="full">Full Page View</option>
          </select>

          <label htmlFor="filterModeSelect" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Contrast:</label>
          <select
            id="filterModeSelect"
            className={styles.filterSelect}
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value as any)}
            aria-label="Image Filter"
          >
            <option value="contrast">High Contrast (Text boost)</option>
            <option value="dark">Dark IDE Invert</option>
            <option value="sharpen">Edge Sharpening</option>
            <option value="standard">Standard Resolution</option>
          </select>

          <button
            type="button"
            className={styles.closeBtn}
            onClick={() => setZoom(Math.max(1.0, zoom - 0.25))}
            title="Zoom Out"
          >
            <ZoomOut size={16} />
          </button>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={() => setZoom(Math.min(3.5, zoom + 0.25))}
            title="Zoom In"
          >
            <ZoomIn size={16} />
          </button>

          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            title="Close Code Focus Mode (ESC)"
            aria-label="Close Code Focus"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className={styles.modalBody}>
        {canvasElement ? (
          <div
            className={`${styles.zoomContainer} ${getFilterClass()}`}
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: region === 'top' ? 'top center' : region === 'bottom' ? 'bottom center' : 'center',
            }}
          >
            {/* Render a replica image from the canvas */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={canvasElement.toDataURL()}
              alt="Magnified code screenshot"
              style={{
                maxWidth: '650px',
                height: 'auto',
                display: 'block',
              }}
            />
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)' }}>Capturing high-resolution page raster...</div>
        )}
      </div>

      <div className={styles.disclaimerBanner}>
        <Info size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
        <span>
          Precision viewport magnification for diagrams and code text. Digital magnification does not enhance native source image resolution.
        </span>
      </div>
    </div>
  );
}
