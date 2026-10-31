'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Settings,
  Moon,
  Sun,
  Laptop,
  BookOpen,
  HardDrive,
  Trash2,
  LogOut,
  CheckCircle2,
} from 'lucide-react';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Sidebar } from '@/components/layout/Sidebar';
import { api } from '@/lib/api/client';
import { Profile } from '@/lib/types/database';

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const [defaultZoom, setDefaultZoom] = useState('1.15');
  const [defaultViewMode, setDefaultViewMode] = useState('single');
  const [autoCropEnabled, setAutoCropEnabled] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);

  useEffect(() => {
    api.auth.getMe().then((res) => {
      setUserProfile(res.profile);
    }).catch(() => {});

    const storedZoom = localStorage.getItem('smart_pdf_pref_zoom');
    if (storedZoom) setDefaultZoom(storedZoom);
    const storedView = localStorage.getItem('smart_pdf_pref_view');
    if (storedView) setDefaultViewMode(storedView);
    const storedCrop = localStorage.getItem('smart_pdf_pref_autocrop');
    if (storedCrop) setAutoCropEnabled(storedCrop === 'true');
  }, []);

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('smart_pdf_pref_zoom', defaultZoom);
    localStorage.setItem('smart_pdf_pref_view', defaultViewMode);
    localStorage.setItem('smart_pdf_pref_autocrop', String(autoCropEnabled));
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2000);
  };

  const handleClearCache = () => {
    if (confirm('Clear local offline reading progress and cached thumbnails? Your saved documents and bookmarks will remain intact.')) {
      localStorage.removeItem('smart_pdf_progress_v1');
      alert('Local reader cache cleared successfully.');
    }
  };

  const handleSignOut = async () => {
    try {
      await api.auth.logout();
    } catch (err) {
      console.error('Logout error:', err);
    }
    router.push('/auth/login');
    router.refresh();
  };

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - var(--header-height))', width: '100%' }}>
      <Sidebar />

      <main style={{ flex: 1, padding: '2.5rem', maxWidth: '850px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>Preferences &amp; Account Settings</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.25rem' }}>
            Customize your default reader viewport, theme appearance, and storage preferences.
          </p>
        </div>

        {/* Theme Settings */}
        <section
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>Appearance &amp; Theme</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Choose your interface appearance. Dark theme is active by default to reduce eye strain during technical reading.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.15rem',
                borderRadius: 'var(--radius-sm)',
                background: theme === 'dark' ? 'var(--accent-primary-light)' : 'var(--bg-tertiary)',
                border: theme === 'dark' ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                color: theme === 'dark' ? 'var(--accent-primary)' : 'var(--text-primary)',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              <Moon size={16} />
              <span>Dark Theme (Default)</span>
            </button>

            <button
              type="button"
              onClick={() => setTheme('light')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.15rem',
                borderRadius: 'var(--radius-sm)',
                background: theme === 'light' ? 'var(--accent-primary-light)' : 'var(--bg-tertiary)',
                border: theme === 'light' ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                color: theme === 'light' ? 'var(--accent-primary)' : 'var(--text-primary)',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              <Sun size={16} />
              <span>Light Theme</span>
            </button>

            <button
              type="button"
              onClick={() => setTheme('system')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.15rem',
                borderRadius: 'var(--radius-sm)',
                background: theme === 'system' ? 'var(--accent-primary-light)' : 'var(--bg-tertiary)',
                border: theme === 'system' ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                color: theme === 'system' ? 'var(--accent-primary)' : 'var(--text-primary)',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              <Laptop size={16} />
              <span>System Preference</span>
            </button>
          </div>
        </section>

        {/* Reader Preferences */}
        <section
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>Reader Default Viewport</h2>
            {savedFeedback && (
              <span style={{ fontSize: '0.8rem', color: 'var(--accent-success)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <CheckCircle2 size={14} /> Saved Preferences
              </span>
            )}
          </div>

          <form onSubmit={handleSavePreferences} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label htmlFor="prefZoomSelect" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Default Zoom Scale
                </label>
                <select
                  id="prefZoomSelect"
                  value={defaultZoom}
                  onChange={(e) => setDefaultZoom(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="1.0">100% (Standard 1:1)</option>
                  <option value="1.15">115% (Recommended for Laptop displays)</option>
                  <option value="1.3">130% (Magnified code screenshots)</option>
                  <option value="1.5">150% (High DPI Retina)</option>
                </select>
              </div>

              <div>
                <label htmlFor="prefViewSelect" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Default View Mode
                </label>
                <select
                  id="prefViewSelect"
                  value={defaultViewMode}
                  onChange={(e) => setDefaultViewMode(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="single">Single Page Mode</option>
                  <option value="continuous">Continuous Vertical Scroll</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <input
                type="checkbox"
                id="prefAutoCropCheck"
                checked={autoCropEnabled}
                onChange={(e) => setAutoCropEnabled(e.target.checked)}
              />
              <label htmlFor="prefAutoCropCheck" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Enable Smart Screenshot Crop automatically when opening screenshot PDFs
              </label>
            </div>

            <button
              type="submit"
              style={{
                alignSelf: 'flex-start',
                padding: '0.55rem 1.25rem',
                background: 'var(--accent-primary)',
                color: '#fff',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 600,
                fontSize: '0.85rem',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Save Reader Preferences
            </button>
          </form>
        </section>

        {/* Data & Cache Management */}
        <section
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>Data &amp; Session</h2>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleClearCache}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.55rem 1rem',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              <Trash2 size={15} />
              <span>Clear Local Cache</span>
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.55rem 1rem',
                background: 'transparent',
                border: '1px solid var(--accent-danger)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--accent-danger)',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <LogOut size={15} />
              <span>Sign Out</span>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
