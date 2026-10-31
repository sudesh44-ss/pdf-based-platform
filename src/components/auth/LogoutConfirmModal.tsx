'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  CloudUpload,
  LogOut,
  X,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  FileText,
  BookOpen,
  History,
  RefreshCw,
} from 'lucide-react';
import { localSync, SyncPendingSummary } from '@/lib/storage/indexedDb';
import { api } from '@/lib/api/client';

export interface CategoryResult {
  status: 'synced' | 'partial' | 'failed';
  total: number;
  synced: number;
  failed: number;
}

export interface SyncModalCategories {
  notes: CategoryResult;
  readingProgress: CategoryResult;
  readingHistory: CategoryResult;
}

export interface LogoutConfirmModalProps {
  isOpen: boolean;
  userId: string;
  mode?: 'logout' | 'manual';
  onClose: () => void;
  onLogoutSuccess?: () => void;
}

export function LogoutConfirmModal({
  isOpen,
  userId,
  mode = 'logout',
  onClose,
  onLogoutSuccess,
}: LogoutConfirmModalProps) {
  // Step state: 'confirm' (initial for logout), 'syncing', 'result'
  const [step, setStep] = useState<'confirm' | 'syncing' | 'result'>(
    mode === 'manual' ? 'syncing' : 'confirm'
  );
  const [syncStatus, setSyncStatus] = useState<'idle' | 'in_progress' | 'success' | 'partial' | 'failed'>('idle');
  const [pending, setPending] = useState<SyncPendingSummary | null>(null);
  const [categoryResults, setCategoryResults] = useState<SyncModalCategories | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [loadingAction, setLoadingAction] = useState<'sync' | 'discard' | 'logout' | null>(null);

  // Core synchronization execution
  const executeSync = useCallback(async () => {
    setStep('syncing');
    setSyncStatus('in_progress');
    setErrorMessage(null);
    setLoadingAction('sync');

    try {
      const pendingData = await localSync.getPendingChanges(userId);

      // Push pending records to cloud
      const result = await api.sync.pushPending({
        dirtyNotes: pendingData.dirtyNotes,
        dirtyProgress: pendingData.dirtyProgress,
        dirtyHistory: pendingData.dirtyHistory,
      });

      // Apply snapshot to local IndexedDB, marking ONLY confirmed records as synced
      await localSync.applyServerSnapshot(userId, {
        notes: result.notes,
        readingProgress: result.readingProgress,
        readingHistory: result.readingHistory,
        serverTimestamp: result.serverTimestamp,
        successfulNoteIds: result.successfulNoteIds,
        successfulProgressDocIds: result.successfulProgressDocIds,
        successfulHistoryIds: result.successfulHistoryIds,
      });

      // Inspect any remaining pending items after partial or full sync
      const remainingPending = await localSync.getPendingChanges(userId);
      setPending(remainingPending);

      // Calculate category metrics
      const categories: SyncModalCategories = result.categories || {
        notes: {
          status: result.failedNotes && result.failedNotes.length > 0 ? 'failed' : 'synced',
          total: pendingData.dirtyNotes.length,
          synced: result.successfulNoteIds?.length ?? pendingData.dirtyNotes.length,
          failed: result.failedNotes?.length ?? 0,
        },
        readingProgress: {
          status: result.failedProgress && result.failedProgress.length > 0 ? 'failed' : 'synced',
          total: pendingData.dirtyProgress.length,
          synced: result.successfulProgressDocIds?.length ?? pendingData.dirtyProgress.length,
          failed: result.failedProgress?.length ?? 0,
        },
        readingHistory: {
          status: result.failedHistory && result.failedHistory.length > 0 ? 'failed' : 'synced',
          total: pendingData.dirtyHistory.length,
          synced: result.successfulHistoryIds?.length ?? pendingData.dirtyHistory.length,
          failed: result.failedHistory?.length ?? 0,
        },
      };

      setCategoryResults(categories);

      // Determine overall status
      if (result.synced && result.overallStatus === 'success') {
        setSyncStatus('success');
      } else if (result.overallStatus === 'partial' || (!result.synced && remainingPending.totalDirty > 0)) {
        setSyncStatus('partial');
        setErrorMessage('Some items could not be synchronized to the cloud.');
      } else {
        setSyncStatus('failed');
        setErrorMessage('Failed to synchronize all records to the cloud.');
      }

      setStep('result');
    } catch (err: any) {
      console.error('Synchronization failed:', err);
      setSyncStatus('failed');
      setErrorMessage(
        err.message || 'Network connection interrupted. Please check your internet connection and try again.'
      );

      const remainingPending = await localSync.getPendingChanges(userId).catch(() => null);
      if (remainingPending) setPending(remainingPending);

      setCategoryResults({
        notes: {
          status: 'failed',
          total: pending?.dirtyNotes.length || 0,
          synced: 0,
          failed: pending?.dirtyNotes.length || 0,
        },
        readingProgress: {
          status: 'failed',
          total: pending?.dirtyProgress.length || 0,
          synced: 0,
          failed: pending?.dirtyProgress.length || 0,
        },
        readingHistory: {
          status: 'failed',
          total: pending?.dirtyHistory.length || 0,
          synced: 0,
          failed: pending?.dirtyHistory.length || 0,
        },
      });

      setStep('result');
    } finally {
      setLoadingAction(null);
    }
  }, [userId, pending]);

  // Reset or initialize state whenever modal opens or mode changes
  useEffect(() => {
    if (isOpen && userId) {
      setErrorMessage(null);
      setIsLoggingOut(false);
      setLoadingAction(null);

      localSync
        .getPendingChanges(userId)
        .then((summary) => {
          setPending(summary);
          if (mode === 'manual') {
            setStep('syncing');
            executeSync();
          } else {
            setStep('confirm');
            setSyncStatus('idle');
          }
        })
        .catch((err) => {
          console.error('Error fetching pending changes:', err);
          if (mode === 'manual') {
            setStep('syncing');
            executeSync();
          } else {
            setStep('confirm');
          }
        });
    }
  }, [isOpen, userId, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  // 1. Final Logout Handler (Used by "Continue to Logout" after success or "Logout Without Save")
  const handleFinalLogout = async () => {
    setIsLoggingOut(true);
    setLoadingAction('logout');
    setErrorMessage(null);

    try {
      await api.auth.logout();
      if (onLogoutSuccess) {
        onLogoutSuccess();
      }
    } catch (err: any) {
      console.error('Logout failed:', err);
      setErrorMessage(err.message || 'Failed to complete logout.');
      setIsLoggingOut(false);
      setLoadingAction(null);
    }
  };

  // 2. Discard and Logout Handler
  const handleLogoutWithoutSave = async () => {
    setIsLoggingOut(true);
    setLoadingAction('discard');
    setErrorMessage(null);

    try {
      await localSync.discardUnsynced(userId);
      await api.auth.logout();
      if (onLogoutSuccess) {
        onLogoutSuccess();
      }
    } catch (err: any) {
      console.error('Logout without save failed:', err);
      setErrorMessage(err.message || 'Failed to logout cleanly.');
      setIsLoggingOut(false);
      setLoadingAction(null);
    }
  };

  const hasUnsaved = pending && pending.totalDirty > 0;
  const isSyncInProgress = step === 'syncing' || loadingAction === 'sync';
  const isBusy = isSyncInProgress || isLoggingOut;

  // Helper for rendering category badges in result screens
  const renderCategoryItem = (
    label: string,
    icon: React.ReactNode,
    category?: CategoryResult,
    defaultLabel = 'Up to date'
  ) => {
    const isSuccess = !category || category.status === 'synced';
    const isPartial = category?.status === 'partial';
    const isFailed = category?.status === 'failed';

    let badgeText = defaultLabel;
    let badgeColor = '#10b981';
    let badgeBg = 'rgba(16, 185, 129, 0.12)';
    let badgeBorder = 'rgba(16, 185, 129, 0.25)';

    if (category) {
      if (category.total > 0 && category.synced === category.total) {
        badgeText = `${category.synced} synced`;
      } else if (isPartial) {
        badgeText = `${category.synced}/${category.total} synced`;
        badgeColor = '#eab308';
        badgeBg = 'rgba(234, 179, 8, 0.12)';
        badgeBorder = 'rgba(234, 179, 8, 0.25)';
      } else if (isFailed) {
        badgeText = category.total > 0 ? `${category.failed} failed` : 'Failed';
        badgeColor = '#ef4444';
        badgeBg = 'rgba(239, 68, 68, 0.12)';
        badgeBorder = 'rgba(239, 68, 68, 0.25)';
      }
    }

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.65rem 0.85rem',
          borderRadius: '8px',
          background: 'var(--bg-primary, rgba(0, 0, 0, 0.25))',
          border: '1px solid var(--border-light, rgba(255, 255, 255, 0.06))',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', fontSize: '0.875rem' }}>
          {icon}
          <span style={{ fontWeight: 500, color: 'var(--text-primary, #f3f4f6)' }}>{label}</span>
        </div>
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            padding: '0.2rem 0.55rem',
            borderRadius: '999px',
            background: badgeBg,
            border: `1px solid ${badgeBorder}`,
            color: badgeColor,
          }}
        >
          {badgeText}
        </span>
      </div>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sync-dialog-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
        background: 'rgba(0, 0, 0, 0.7)',
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
          boxShadow: '0 20px 45px rgba(0, 0, 0, 0.5)',
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
                background:
                  step === 'result' && syncStatus === 'success'
                    ? 'rgba(16, 185, 129, 0.15)'
                    : step === 'result' && (syncStatus === 'failed' || syncStatus === 'partial')
                    ? 'rgba(239, 68, 68, 0.15)'
                    : hasUnsaved
                    ? 'rgba(234, 179, 8, 0.15)'
                    : 'rgba(59, 130, 246, 0.15)',
                color:
                  step === 'result' && syncStatus === 'success'
                    ? '#10b981'
                    : step === 'result' && (syncStatus === 'failed' || syncStatus === 'partial')
                    ? '#ef4444'
                    : hasUnsaved
                    ? '#eab308'
                    : '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {step === 'syncing' ? (
                <Loader2 size={20} className="animate-spin" />
              ) : step === 'result' && syncStatus === 'success' ? (
                <CheckCircle2 size={20} />
              ) : step === 'result' && (syncStatus === 'failed' || syncStatus === 'partial') ? (
                <AlertTriangle size={20} />
              ) : hasUnsaved ? (
                <AlertTriangle size={20} />
              ) : (
                <LogOut size={20} />
              )}
            </div>
            <h2
              id="sync-dialog-title"
              style={{
                fontSize: '1.15rem',
                fontWeight: 700,
                color: 'var(--text-primary, #f3f4f6)',
                margin: 0,
              }}
            >
              {step === 'confirm'
                ? 'Confirm Account Logout'
                : step === 'syncing'
                ? 'Synchronizing Data...'
                : syncStatus === 'success'
                ? 'Sync Completed Successfully'
                : 'Synchronization Failed'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted, #9ca3af)',
              cursor: isBusy ? 'not-allowed' : 'pointer',
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
          {errorMessage && (
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
              {errorMessage}
            </div>
          )}

          {/* STEP 1: LOGOUT CONFIRMATION VIEW */}
          {step === 'confirm' && (
            <>
              {hasUnsaved ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '0.925rem',
                      color: 'var(--text-secondary, #d1d5db)',
                      lineHeight: 1.5,
                    }}
                  >
                    You have <strong>{pending.totalDirty} unsaved local change(s)</strong> that have not yet been synchronized with your account.
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
                        <span>
                          <strong>{pending.dirtyNotes.length}</strong> local note update(s)
                        </span>
                      </div>
                    )}
                    {pending.dirtyProgress.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <BookOpen size={15} color="#10b981" />
                        <span>
                          <strong>{pending.dirtyProgress.length}</strong> reading progress state(s)
                        </span>
                      </div>
                    )}
                    {pending.dirtyHistory.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <History size={15} color="#8b5cf6" />
                        <span>
                          <strong>{pending.dirtyHistory.length}</strong> reading session log(s)
                        </span>
                      </div>
                    )}
                  </div>

                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted, #9ca3af)' }}>
                    Syncing now ensures your reading progress and notes are available across all your devices.
                  </p>
                </div>
              ) : (
                <p
                  style={{
                    margin: 0,
                    fontSize: '0.925rem',
                    color: 'var(--text-secondary, #d1d5db)',
                    lineHeight: 1.5,
                  }}
                >
                  All your personal reading notes and progress are currently synchronized with the cloud. Are you sure you want to log out?
                </p>
              )}
            </>
          )}

          {/* STEP 2: SYNCHRONIZATION IN PROGRESS VIEW */}
          {step === 'syncing' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1.5rem 0',
                gap: '1rem',
              }}
            >
              <Loader2 size={36} color="#3b82f6" className="animate-spin" />
              <div style={{ textAlign: 'center' }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    color: 'var(--text-primary, #f3f4f6)',
                  }}
                >
                  Synchronizing with Cloud...
                </p>
                <p
                  style={{
                    margin: '0.25rem 0 0',
                    fontSize: '0.825rem',
                    color: 'var(--text-muted, #9ca3af)',
                  }}
                >
                  Uploading your local notes, reading progress, and reading history safely.
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: SYNCHRONIZATION RESULT VIEW */}
          {step === 'result' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.925rem',
                  color: 'var(--text-secondary, #d1d5db)',
                  lineHeight: 1.5,
                }}
              >
                {syncStatus === 'success'
                  ? 'Your data has been safely synchronized with your account.'
                  : 'We encountered an issue during synchronization. Unsynchronized local data is preserved in your browser.'}
              </p>

              {/* Category Breakdown Status Grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {renderCategoryItem(
                  'Notes',
                  <FileText size={16} color="#3b82f6" />,
                  categoryResults?.notes
                )}
                {renderCategoryItem(
                  'Reading History',
                  <History size={16} color="#8b5cf6" />,
                  categoryResults?.readingHistory
                )}
                {renderCategoryItem(
                  'Reading Progress',
                  <BookOpen size={16} color="#10b981" />,
                  categoryResults?.readingProgress
                )}
              </div>

              {syncStatus !== 'success' && (
                <p
                  style={{
                    margin: 0,
                    fontSize: '0.825rem',
                    color: 'var(--text-muted, #9ca3af)',
                    lineHeight: 1.4,
                  }}
                >
                  Unsynchronized records remain stored locally in your browser. Retrying uses stable identifiers and will never duplicate entries.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons Footer */}
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
          {/* STEP 1: INITIAL LOGOUT CONFIRMATION BUTTONS */}
          {step === 'confirm' && (
            <>
              {/* Action 1: Sync Data & Logout */}
              <button
                type="button"
                onClick={executeSync}
                disabled={isBusy}
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
                  cursor: isBusy ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
                  transition: 'all 0.15s ease',
                }}
              >
                <CloudUpload size={17} />
                <span>Sync Data &amp; Logout</span>
              </button>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                {/* Action 2: Logout Without Save */}
                <button
                  type="button"
                  onClick={handleLogoutWithoutSave}
                  disabled={isBusy}
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
                    cursor: isBusy ? 'not-allowed' : 'pointer',
                    opacity: isBusy && loadingAction !== 'discard' ? 0.6 : 1,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isBusy && loadingAction === 'discard' ? (
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
                  disabled={isBusy}
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
                    cursor: isBusy ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Cancel
                </button>
              </div>
            </>
          )}

          {/* STEP 2: SYNC IN PROGRESS (Buttons Disabled) */}
          {step === 'syncing' && (
            <button
              type="button"
              disabled
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                border: 'none',
                background: 'rgba(59, 130, 246, 0.4)',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.925rem',
                cursor: 'not-allowed',
              }}
            >
              <Loader2 size={17} className="animate-spin" />
              <span>Synchronizing...</span>
            </button>
          )}

          {/* STEP 3: SYNC RESULT BUTTONS */}
          {step === 'result' && (
            <>
              {syncStatus === 'success' ? (
                // SUCCESS ACTIONS
                mode === 'logout' ? (
                  // Logout Mode on Success: Continue to Logout / Stay Logged In
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.65rem' }}>
                    <button
                      type="button"
                      onClick={handleFinalLogout}
                      disabled={isBusy}
                      style={{
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
                        cursor: isBusy ? 'not-allowed' : 'pointer',
                        boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
                      }}
                    >
                      {isLoggingOut ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <LogOut size={16} />
                      )}
                      <span>Continue to Logout</span>
                    </button>

                    <button
                      type="button"
                      onClick={onClose}
                      disabled={isBusy}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0.75rem 1rem',
                        borderRadius: '10px',
                        border: '1px solid var(--border-medium, rgba(255, 255, 255, 0.15))',
                        background: 'transparent',
                        color: 'var(--text-secondary, #d1d5db)',
                        fontWeight: 500,
                        fontSize: '0.925rem',
                        cursor: isBusy ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Stay Logged In
                    </button>
                  </div>
                ) : (
                  // Manual Sync Mode on Success: Done (never logs out)
                  <button
                    type="button"
                    onClick={onClose}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      padding: '0.75rem 1rem',
                      borderRadius: '10px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: '#ffffff',
                      fontWeight: 600,
                      fontSize: '0.925rem',
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                    }}
                  >
                    <CheckCircle2 size={17} />
                    <span>Done</span>
                  </button>
                )
              ) : (
                // FAILED OR PARTIAL ACTIONS
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.65rem' }}>
                  {/* Action: Retry Sync */}
                  <button
                    type="button"
                    onClick={executeSync}
                    disabled={isBusy}
                    style={{
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
                      cursor: isBusy ? 'not-allowed' : 'pointer',
                      boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
                    }}
                  >
                    <RefreshCw size={16} />
                    <span>Retry Sync</span>
                  </button>

                  {/* Action: Cancel & Stay Logged In (Never logs out!) */}
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isBusy}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0.75rem 1rem',
                      borderRadius: '10px',
                      border: '1px solid var(--border-medium, rgba(255, 255, 255, 0.15))',
                      background: 'transparent',
                      color: 'var(--text-secondary, #d1d5db)',
                      fontWeight: 500,
                      fontSize: '0.85rem',
                      cursor: isBusy ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {mode === 'logout' ? 'Cancel & Stay Logged In' : 'Close'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Re-export as SyncModal for semantic usage
export const SyncModal = LogoutConfirmModal;
