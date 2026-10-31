'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CropSettings, ReadingProgress, ViewMode } from '@/lib/types/database';
import { api } from '@/lib/api/client';
import { localProgress, localHistory } from '@/lib/storage/indexedDb';
import { ReaderToolbar } from './ReaderToolbar';
import { SmartCropOverlay } from './SmartCropOverlay';
import { NotesSplitPanel } from './NotesSplitPanel';
import styles from './PdfViewer.module.css';

// Dynamically import heavy drawer and code focus modal to reduce initial reader bundle size
const ThumbnailDrawer = React.lazy(() =>
  import('./ThumbnailDrawer').then((m) => ({ default: m.ThumbnailDrawer }))
);
const CodeFocusModal = React.lazy(() =>
  import('./CodeFocusModal').then((m) => ({ default: m.CodeFocusModal }))
);

interface PdfViewerProps {
  documentId: string;
  documentTitle: string;
  pdfUrl: string;
  initialPage?: number;
  totalPages?: number;
}

export function PdfViewer({
  documentId,
  documentTitle,
  pdfUrl,
  initialPage = 1,
  totalPages: propTotalPages = 1,
}: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const currentRenderTaskRef = useRef<any>(null);
  const currentTextLayerRef = useRef<any>(null);

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(propTotalPages);
  const [zoom, setZoom] = useState(1.15);
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Tools & Modals
  const [cropSettings, setCropSettings] = useState<CropSettings>({
    enabled: false,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  });
  const [codeFocusOpen, setCodeFocusOpen] = useState(false);
  const [thumbnailsOpen, setThumbnailsOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [userId, setUserId] = useState<string>('local_user');

  // Active reading time tracking
  const activeSecondsRef = useRef(0);

  // 0. Detect active user session
  useEffect(() => {
    let isMounted = true;
    api.auth
      .getMe()
      .then((data) => {
        if (isMounted && data.user?.id) {
          setUserId(data.user.id);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  // 1. Load saved progress from local-first IndexedDB, with cloud fallback on fresh devices
  useEffect(() => {
    let isMounted = true;

    async function restoreProgress() {
      try {
        const local = await localProgress.get(documentId, userId);
        if (local && isMounted) {
          if (local.current_page > 0) setCurrentPage(local.current_page);
          if (local.zoom_level && local.zoom_level > 0) setZoom(local.zoom_level);
          if (local.crop_settings) setCropSettings(local.crop_settings);
          if (local.view_mode) setViewMode(local.view_mode as ViewMode);
          return;
        }

        // Fresh device fallback: check Supabase snapshot if no local record
        const res = await api.readingProgress.list(documentId);
        if (!isMounted) return;
        const found = res.progressList?.[0]?.progress;
        if (found) {
          if (found.current_page > 0) setCurrentPage(found.current_page);
          if (found.zoom_level > 0) setZoom(found.zoom_level);
          if (found.crop_settings) setCropSettings(found.crop_settings);
          if (found.view_mode) setViewMode(found.view_mode);
        }
      } catch {
        // Fallback or offline
      }
    }

    restoreProgress();

    // Bookmarks continue to sync automatically through Supabase
    api.bookmarks
      .list(documentId)
      .then((res) => {
        if (!isMounted) return;
        const bms = res.bookmarks || [];
        setIsBookmarked(bms.some((b) => b.page_number === currentPage));
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [documentId, currentPage, userId]);

  // 2. Active reading ticker: persists ONLY to local IndexedDB, NEVER auto-uploaded to Supabase
  useEffect(() => {
    const timer = setInterval(() => {
      activeSecondsRef.current += 1;

      // Persist progress to IndexedDB every 15 seconds
      if (activeSecondsRef.current % 15 === 0 && totalPages > 0) {
        localProgress
          .save(
            {
              document_id: documentId,
              current_page: currentPage,
              total_pages: totalPages,
              zoom_level: zoom,
              crop_settings: cropSettings,
              view_mode: viewMode,
              active_seconds: 15,
            },
            userId
          )
          .catch(() => {});

        localHistory
          .record(
            {
              document_id: documentId,
              document_title: documentTitle,
              page_number: currentPage,
              active_seconds: 15,
            },
            userId
          )
          .catch(() => {});
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [documentId, documentTitle, currentPage, totalPages, zoom, cropSettings, viewMode, userId]);

  // 3. Initialize PDF.js
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setErrorMessage(null);

    async function loadPdf() {
      try {
        const pdfjs = await import('pdfjs-dist');
        // Point worker to public root
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

        const loadingTask = pdfjs.getDocument({
          url: pdfUrl,
          cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
          cMapPacked: true,
        });

        const doc = await loadingTask.promise;
        if (!isMounted) return;

        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setLoading(false);
      } catch (err: any) {
        if (!isMounted) return;
        setLoading(false);
        if (err.name === 'PasswordException') {
          setErrorMessage('This PDF document is password protected.');
        } else {
          setErrorMessage(err.message || 'Failed to load PDF document.');
        }
      }
    }

    loadPdf();

    return () => {
      isMounted = false;
      if (currentRenderTaskRef.current) {
        currentRenderTaskRef.current.cancel();
      }
      if (currentTextLayerRef.current) {
        try {
          currentTextLayerRef.current.cancel();
        } catch {
          // Ignored
        }
      }
    };
  }, [pdfUrl]);

  // 4. Render Current Page on Canvas and Text Layer
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;

    if (currentRenderTaskRef.current) {
      try {
        currentRenderTaskRef.current.cancel();
      } catch {
        // Ignored
      }
    }

    if (currentTextLayerRef.current) {
      try {
        currentTextLayerRef.current.cancel();
      } catch {
        // Ignored
      }
      currentTextLayerRef.current = null;
    }

    try {
      const page = await pdfDoc.getPage(currentPage);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return;

      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      const viewport = page.getViewport({ scale: zoom });

      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      ctx.save();
      ctx.scale(dpr, dpr);

      const renderContext = {
        canvasContext: ctx,
        viewport,
      };

      const task = page.render(renderContext);
      currentRenderTaskRef.current = task;
      await task.promise;
      ctx.restore();

      // Render Text Layer for browser-native selection & copy
      if (textLayerRef.current) {
        const textLayerDiv = textLayerRef.current;
        textLayerDiv.innerHTML = '';
        textLayerDiv.style.width = `${Math.floor(viewport.width)}px`;
        textLayerDiv.style.height = `${Math.floor(viewport.height)}px`;
        textLayerDiv.style.setProperty('--scale-factor', `${viewport.scale}`);
        textLayerDiv.style.setProperty('--total-scale-factor', `${viewport.scale}`);

        try {
          const textContent = await page.getTextContent();
          const pdfjs = await import('pdfjs-dist');

          if (pdfjs.TextLayer) {
            const textLayer = new pdfjs.TextLayer({
              textContentSource: textContent,
              container: textLayerDiv,
              viewport,
            });
            currentTextLayerRef.current = textLayer;
            await textLayer.render();
          } else if (typeof (pdfjs as any).renderTextLayer === 'function') {
            const textTask = (pdfjs as any).renderTextLayer({
              textContent,
              container: textLayerDiv,
              viewport,
              textDivs: [],
            });
            await textTask.promise;
          }
        } catch (textErr: any) {
          if (textErr?.name !== 'RenderingCancelledException') {
            console.warn('Text layer render notice:', textErr);
          }
        }
      }
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.error('Page render error:', err);
      }
    }
  }, [pdfDoc, currentPage, zoom]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  // 5. Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in an input, textarea or contenteditable element
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.closest('.tiptap') ||
          target.closest('[contenteditable="true"]'))
      ) {
        return;
      }

      // Preserve native browser shortcuts: Ctrl+C / Cmd+C (copy), Ctrl+A (select all), etc.
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        setCurrentPage((prev) => Math.min(totalPages, prev + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        setCurrentPage((prev) => Math.max(1, prev - 1));
      } else if (e.key === '=' || e.key === '+') {
        setZoom((prev) => Math.min(3.0, Math.round((prev + 0.15) * 100) / 100));
      } else if (e.key === '-') {
        setZoom((prev) => Math.max(0.4, Math.round((prev - 0.15) * 100) / 100));
      } else if (e.key.toLowerCase() === 'c') {
        setCropSettings((prev) => ({ ...prev, enabled: !prev.enabled }));
      } else if (e.key.toLowerCase() === 'f') {
        toggleFullscreen();
      } else if (e.key.toLowerCase() === 'b') {
        toggleBookmark();
      } else if (e.key.toLowerCase() === 'n') {
        setNotesOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [totalPages]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const toggleBookmark = async () => {
    if (isBookmarked) {
      try {
        const res = await api.bookmarks.list(documentId);
        const match = res.bookmarks?.find((b) => b.page_number === currentPage);
        if (match) {
          await api.bookmarks.delete(match.id);
        }
      } catch (err) {
        console.error('Error removing bookmark:', err);
      }
      setIsBookmarked(false);
    } else {
      try {
        await api.bookmarks.create({
          document_id: documentId,
          page_number: currentPage,
          title: `Page ${currentPage} — ${documentTitle}`,
        });
      } catch (err) {
        console.error('Error adding bookmark:', err);
      }
      setIsBookmarked(true);
    }
  };

  const handleFitWidth = () => {
    if (containerRef.current && canvasRef.current) {
      const availableWidth =
        containerRef.current.clientWidth -
        (thumbnailsOpen ? 220 : 0) -
        (notesOpen ? 360 : 0) -
        80;
      const baseWidth = 612; // Standard PDF point width
      const newZoom = Math.max(
        0.5,
        Math.min(2.5, Math.round((availableWidth / baseWidth) * 100) / 100)
      );
      setZoom(newZoom);
    }
  };

  const handleFitPage = () => {
    if (containerRef.current) {
      const availableHeight = containerRef.current.clientHeight - 120;
      const baseHeight = 792;
      const newZoom = Math.max(
        0.5,
        Math.min(2.0, Math.round((availableHeight / baseHeight) * 100) / 100)
      );
      setZoom(newZoom);
    }
  };

  return (
    <div ref={containerRef} className={styles.readerContainer}>
      <ReaderToolbar
        title={documentTitle}
        currentPage={currentPage}
        totalPages={totalPages}
        zoom={zoom}
        viewMode={viewMode}
        isSmartCrop={cropSettings.enabled}
        isBookmarked={isBookmarked}
        notesOpen={notesOpen}
        thumbnailsOpen={thumbnailsOpen}
        isFullscreen={isFullscreen}
        onPageChange={(p) => setCurrentPage(p)}
        onZoomChange={(z) => setZoom(z)}
        onFitWidth={handleFitWidth}
        onFitPage={handleFitPage}
        onToggleViewMode={() => setViewMode(viewMode === 'single' ? 'continuous' : 'single')}
        onToggleSmartCrop={() =>
          setCropSettings({ ...cropSettings, enabled: !cropSettings.enabled })
        }
        onOpenCodeFocus={() => setCodeFocusOpen(true)}
        onToggleBookmark={toggleBookmark}
        onToggleNotes={() => setNotesOpen((prev) => !prev)}
        onToggleThumbnails={() => setThumbnailsOpen(!thumbnailsOpen)}
        onToggleFullscreen={toggleFullscreen}
      />

      <div className={styles.workspaceLayout}>
        {thumbnailsOpen && (
          <React.Suspense fallback={<div className={styles.drawerSkeleton} />}>
            <ThumbnailDrawer
              totalPages={totalPages}
              currentPage={currentPage}
              onPageSelect={(p) => setCurrentPage(p)}
              onClose={() => setThumbnailsOpen(false)}
            />
          </React.Suspense>
        )}

        <div className={styles.canvasScrollArea}>
          {loading && (
            <div className={styles.loadingOverlay}>
              <div className={styles.spinner} />
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Loading PDF.js Canvas Engine...
              </span>
            </div>
          )}

          {errorMessage ? (
            <div className={styles.errorBox}>
              <h3 style={{ color: 'var(--accent-danger)' }}>Could Not Render Document</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{errorMessage}</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'var(--accent-primary)',
                  color: '#fff',
                  borderRadius: 'var(--radius-sm)',
                  alignSelf: 'center',
                }}
              >
                Retry Loading
              </button>
            </div>
          ) : (
            <div
              className={`${styles.pageCard} ${cropSettings.enabled ? styles.cropActive : ''}`}
              style={{
                clipPath: cropSettings.enabled
                  ? `inset(${cropSettings.y}% ${cropSettings.x}% ${100 - cropSettings.height}% ${cropSettings.x}%)`
                  : 'none',
              }}
            >
              <canvas ref={canvasRef} className={styles.canvasElement} />
              <div ref={textLayerRef} className={`${styles.textLayer} textLayer`} />
            </div>
          )}

          {cropSettings.enabled && (
            <SmartCropOverlay
              settings={cropSettings}
              onChange={(s) => setCropSettings(s)}
              onReset={() =>
                setCropSettings({ enabled: false, x: 0, y: 0, width: 100, height: 100 })
              }
            />
          )}
        </div>

        {/* Study Notes Split Panel (Local-First IndexedDB) */}
        {notesOpen && (
          <NotesSplitPanel
            documentId={documentId}
            documentTitle={documentTitle}
            currentPage={currentPage}
            userId={userId}
            onJumpToPage={(p) => setCurrentPage(p)}
            onClose={() => setNotesOpen(false)}
          />
        )}
      </div>

      {codeFocusOpen && (
        <React.Suspense fallback={null}>
          <CodeFocusModal
            canvasElement={canvasRef.current}
            onClose={() => setCodeFocusOpen(false)}
          />
        </React.Suspense>
      )}
    </div>
  );
}
