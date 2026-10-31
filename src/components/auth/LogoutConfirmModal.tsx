'use client';

import React, { useState, useEffect } from 'react';
import {
  CloudUpload,
  LogOut,
  X,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  FileText,
  BookOpen,
} from 'lucide-react';
import { localSync, SyncPendingSummary } from '@/lib/storage/indexedDb';
import { api } from '@/lib/api/client';

interface LogoutConfirmModalProps {
  isOpen: boolean;
  userId: string;
  onClose: () => void;
  onLogoutSuccess: () => void;
}

export function LogoutConfirmModal({
  isOpen,
  userId,
  onClose,
  onLogoutSuccess,
}: LogoutConfirmModalProps) {
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<'sync' | 'discard' | null>(null);
  const [pending, setPending] = useState<SyncPendingSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && userId) {
      setError(null);
      localSync
        .getPendingChanges(userId)
        .then((summary) => setPending(summary))
        .catch((err) => console.error('Error fetching pending changes:', err));
    }
  }, [isOpen, userId]);

  if (!isOpen) return null;

  // 1. Sync Data & Logout
  const handleSyncAndLogout = async () => {
    setLoading(true);
    setLoadingAction('sync');
    setError(null);

    try {
      const pendingData = await localSync.getPendingChanges(userId);

      // Push pending to Supabase
      const result = await api.sync.pushPending({
        dirtyNotes: pendingData.dirtyNotes,
        dirtyProgress: pendingData.dirtyProgress,
        dirtyHistory: pendingData.dirtyHistory,
      });

      // Update local storage with canonical server snapshot
      await localSync.applyServerSnapshot(userId, {
        notes: result.notes,
        readingProgress: result.readingProgress,
        readingHistory: result.readingHistory,
        serverTimestamp: result.serverTimestamp,
      });

      // Execute normal auth logout
      await api.auth.logout();
      onLogoutSuccess();
    } catch (err: any) {
      console.error('Sync & Logout failed:', err);
      setError(err.message || 'Failed to sync data to the cloud. You can still choose "Logout Without Save" or Cancel.');
    } finally {
      setLoading(false);
      setLoadingAction(null);
    }
  };

  // 2. Logout Without Save
  const handleLogoutWithoutSave = async () => {
    setLoading(true);
    setLoadingAction('discard');
    setError(null);

    try {
      // Discards only unsynced changes of the current account; preserves cloud copy
      await localSync.discardUnsynced(userId);

      // Execute normal auth logout
      await api.auth.logout();
      onLogoutSuccess();
    } catch (err: any) {
      console.error('Logout without save failed:', err);
      setError(err.message || 'Failed to logout cleanly.');
    } finally {
      setLoading(false);
      setLoadingAction(null);
    }
  };

  const hasUnsaved = pending && pending.totalDirty > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-dialog-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          background: 'var(--bg-secondary, #141721)',
          border: '1px solid var(--border-medium, rgba(255, 255, 255, 0.12))',
          borderRadius: '16px',
          boxShadow: '0 20px 45px rgba(0, 0, 0, 0.45)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'fadeInScale 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-light, rgba(255, 255, 255, 0.08))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: hasUnsaved ? 'rgba(234, 179, 8, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                color: hasUnsaved ? '#eab308' : '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {hasUnsaved ? <AlertTriangle size={20} /> : <LogOut size={20} />}
            </div>
            <h2
              id="logout-dialog-title"
              style={{
                fontSize: '1.15rem',
                fontWeight: 700,
                color: 'var(--text-primary, #f3f4f6)',
                margin: 0,
              }}
            >
              Confirm Account Logout
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted, #9ca3af)',
              cursor: loading ? 'not-allowed' : 'pointer',
              padding: '0.35rem',
              borderRadius: '6px',
            }}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && (
            <div
              style={{
                padding: '0.75rem 1rem',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                color: '#ef4444',
                fontSize: '0.85rem',
              }}
            >
              {error}
            </div>
          )}

          {hasUnsaved ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <p style={{ margin: 0, fontSize: '0.925rem', color: 'var(--text-secondary, #d1d5db)', lineHeight: 1.5 }}>
                You have <strong>{pending.totalDirty} unsaved local change(s)</strong> that have not yet been synchronized with the cloud.
              </p>

              <div
                style={{
                  background: 'var(--bg-primary, rgba(0, 0, 0, 0.25))',
                  padding: '0.85rem 1rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border-light, rgba(255, 255, 255, 0.06))',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.45rem',
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary, #9ca3af)',
                }}
              >
                {pending.dirtyNotes.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileText size={15} color="#3b82f6" />
                    <span><strong>{pending.dirtyNotes.length}</strong> local note update(s)</span>
                  </div>
                )}
                {pending.dirtyProgress.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <BookOpen size={15} color="#10b981" />
                    <span><strong>{pending.dirtyProgress.length}</strong> reading progress state(s)</span>
                  </div>
                )}
                {pending.dirtyHistory.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CheckCircle2 size={15} color="#8b5cf6" />
                    <span><strong>{pending.dirtyHistory.length}</strong> reading session log(s)</span>
                  </div>
                )}
              </div>

              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted, #9ca3af)' }}>
                Syncing now ensures your reading progress and notes are available across your devices.
              </p>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: '0.925rem', color: 'var(--text-secondary, #d1d5db)', lineHeight: 1.5 }}>
              All your personal reading notes and progress are currently synchronized with the cloud. Are you sure you want to log out?
            </p>
          )}
        </div>

        {/* Action Buttons (Exactly 3 actions) */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            background: 'var(--bg-primary, rgba(0, 0, 0, 0.2))',
            borderTop: '1px solid var(--border-light, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
          }}
        >
          {/* Action 1: Sync Data & Logout */}
          <button
            type="button"
            onClick={handleSyncAndLogout}
            disabled={loading}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.925rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading && loadingAction !== 'sync' ? 0.6 : 1,
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
              transition: 'all 0.15s ease',
            }}
          >
            {loading && loadingAction === 'sync' ? (
              <>
                <Loader2 size={17} className="animate-spin" />
                <span>Syncing Cloud &amp; Logging Out...</span>
              </>
            ) : (
              <>
                <CloudUpload size={17} />
                <span>Sync Data &amp; Logout</span>
              </>
            )}
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
            {/* Action 2: Logout Without Save */}
            <button
              type="button"
              onClick={handleLogoutWithoutSave}
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.45rem',
                padding: '0.65rem 0.85rem',
                borderRadius: '10px',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading && loadingAction !== 'discard' ? 0.6 : 1,
                transition: 'all 0.15s ease',
              }}
            >
              {loading && loadingAction === 'discard' ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <LogOut size={15} />
              )}
              <span>Logout Without Save</span>
            </button>

            {/* Action 3: Cancel */}
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.65rem 0.85rem',
                borderRadius: '10px',
                border: '1px solid var(--border-medium, rgba(255, 255, 255, 0.15))',
                background: 'transparent',
                color: 'var(--text-secondary, #d1d5db)',
                fontWeight: 500,
                fontSize: '0.85rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
