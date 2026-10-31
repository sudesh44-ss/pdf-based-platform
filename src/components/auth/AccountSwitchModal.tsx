'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldAlert,
  ArrowRightLeft,
  X,
  Loader2,
  AlertTriangle,
  CloudUpload,
  User,
  Shield,
} from 'lucide-react';
import { localSync, SyncPendingSummary } from '@/lib/storage/indexedDb';
import { api } from '@/lib/api/client';

export interface AccountSwitchModalProps {
  isOpen: boolean;
  targetRole: 'admin' | 'user'; // 'admin' = currently Normal User, switching to Admin; 'user' = currently Admin, switching to User
  nextUrl?: string;
  currentUserId?: string;
  onCancel?: () => void;
  onSwitchSuccess?: () => void;
}

export function AccountSwitchModal({
  isOpen,
  targetRole,
  nextUrl,
  currentUserId,
  onCancel,
  onSwitchSuccess,
}: AccountSwitchModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<SyncPendingSummary | null>(null);
  const [syncBeforeSwitch, setSyncBeforeSwitch] = useState(false);

  // Check pending local data if switching away from a normal user
  useEffect(() => {
    if (isOpen && targetRole === 'admin' && currentUserId) {
      localSync
        .getPendingChanges(currentUserId)
        .then((summary) => {
          setPending(summary);
          if (summary && summary.totalDirty > 0) {
            setSyncBeforeSwitch(true);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, targetRole, currentUserId]);

  if (!isOpen) return null;

  const isSwitchingToAdmin = targetRole === 'admin';

  const handleConfirmSwitch = async (shouldSync: boolean = false) => {
    setLoading(true);
    setError(null);

    try {
      if (isSwitchingToAdmin) {
        // 1. If user has dirty data and chose to sync:
        if (shouldSync && currentUserId) {
          try {
            const pendingData = await localSync.getPendingChanges(currentUserId);
            const res = await api.sync.pushPending({
              dirtyNotes: pendingData.dirtyNotes,
              dirtyProgress: pendingData.dirtyProgress,
              dirtyHistory: pendingData.dirtyHistory,
            });
            await localSync.applyServerSnapshot(currentUserId, {
              notes: res.notes,
              readingProgress: res.readingProgress,
              readingHistory: res.readingHistory,
              serverTimestamp: res.serverTimestamp,
            });
          } catch (syncErr: any) {
            console.warn('Sync before switch notice:', syncErr);
            // Non-fatal: local data remains in IndexedDB for when user returns to this account
          }
        }

        // 2. Terminate Normal User session on this browser only (local scope)
        await api.auth.logout();

        if (onSwitchSuccess) {
          onSwitchSuccess();
        } else {
          const dest = nextUrl || '/admin/login';
          router.push(dest);
          router.refresh();
        }
      } else {
        // Switching to Normal User: Terminate Admin session on this browser only
        await api.adminAuth.logout();

        if (onSwitchSuccess) {
          onSwitchSuccess();
        } else {
          const dest = nextUrl || '/auth/login';
          router.push(dest);
          router.refresh();
        }
      }
    } catch (err: any) {
      console.error('Account switch failed:', err);
      setError(err.message || 'Failed to switch accounts cleanly.');
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      if (isSwitchingToAdmin) {
        // Stay on user side
        router.push('/dashboard');
      } else {
        // Stay on admin side
        router.push('/admin');
      }
    }
  };

  const hasUnsaved = pending && pending.totalDirty > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="switch-account-dialog-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          background: 'var(--bg-secondary, #101522)',
          border: '1px solid var(--border-medium, rgba(255, 255, 255, 0.15))',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
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
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: isSwitchingToAdmin ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                color: isSwitchingToAdmin ? '#ef4444' : '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ArrowRightLeft size={20} />
            </div>
            <h2
              id="switch-account-dialog-title"
              style={{
                fontSize: '1.2rem',
                fontWeight: 800,
                color: 'var(--text-primary, #f1f5f9)',
                margin: 0,
              }}
            >
              Switch Account?
            </h2>
          </div>
          <button
            onClick={handleCancel}
            disabled={loading}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted, #94a3b8)',
              cursor: loading ? 'not-allowed' : 'pointer',
              padding: '0.35rem',
              borderRadius: '6px',
            }}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
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

          <p
            style={{
              margin: 0,
              fontSize: '0.95rem',
              color: 'var(--text-primary, #f1f5f9)',
              lineHeight: 1.5,
              fontWeight: 500,
            }}
          >
            {isSwitchingToAdmin
              ? 'A Normal User account is currently logged in on this browser. To access the Admin Panel, you must switch accounts.'
              : 'An Admin account is currently logged in on this browser. To continue as a Normal User, you must switch accounts.'}
          </p>

          {isSwitchingToAdmin && hasUnsaved && (
            <div
              style={{
                padding: '0.85rem 1rem',
                background: 'rgba(234, 179, 8, 0.1)',
                border: '1px solid rgba(234, 179, 8, 0.25)',
                borderRadius: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                fontSize: '0.85rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#eab308', fontWeight: 600 }}>
                <AlertTriangle size={15} />
                <span>Unsaved Local Changes Detected</span>
              </div>
              <p style={{ margin: 0, color: 'var(--text-secondary, #94a3b8)' }}>
                You have <strong>{pending.totalDirty} unsaved item(s)</strong> stored locally. Syncing will upload them to the cloud before switching. Local data will remain safe on this device either way.
              </p>
            </div>
          )}

          <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--text-muted, #64748b)' }}>
            Only one account type can be active per browser profile. Switching will terminate the current account session on this browser without affecting sessions on your other devices.
          </p>
        </div>

        {/* Actions */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            background: 'var(--bg-primary, rgba(0, 0, 0, 0.25))',
            borderTop: '1px solid var(--border-light, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
          }}
        >
          {isSwitchingToAdmin && hasUnsaved ? (
            <>
              {/* Option 1: Sync & Switch to Admin */}
              <button
                type="button"
                onClick={() => handleConfirmSwitch(true)}
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
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.925rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(239, 68, 68, 0.35)',
                }}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <CloudUpload size={16} />}
                <span>Sync Data &amp; Switch to Admin</span>
              </button>

              {/* Option 2: Switch to Admin (preserve local data without cloud sync) */}
              <button
                type="button"
                onClick={() => handleConfirmSwitch(false)}
                disabled={loading}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.65rem 1rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border-medium)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                <Shield size={15} color="#ef4444" />
                <span>Switch to Admin</span>
              </button>
            </>
          ) : (
            /* Single Primary Switch Action */
            <button
              type="button"
              onClick={() => handleConfirmSwitch(false)}
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
                background: isSwitchingToAdmin
                  ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                  : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.925rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: isSwitchingToAdmin
                  ? '0 4px 14px rgba(239, 68, 68, 0.35)'
                  : '0 4px 14px rgba(59, 130, 246, 0.35)',
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Switching Accounts...</span>
                </>
              ) : isSwitchingToAdmin ? (
                <>
                  <Shield size={16} />
                  <span>Switch to Admin</span>
                </>
              ) : (
                <>
                  <User size={16} />
                  <span>Switch to Normal User</span>
                </>
              )}
            </button>
          )}

          {/* Action 2: Cancel */}
          <button
            type="button"
            onClick={handleCancel}
            disabled={loading}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.65rem 1rem',
              borderRadius: '10px',
              border: '1px solid var(--border-medium, rgba(255, 255, 255, 0.15))',
              background: 'transparent',
              color: 'var(--text-secondary, #94a3b8)',
              fontWeight: 500,
              fontSize: '0.85rem',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
