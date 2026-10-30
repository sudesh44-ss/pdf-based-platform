'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  User,
  Mail,
  Calendar,
  Clock,
  BookOpen,
  Heart,
  BookMarked,
  Highlighter,
  FileText,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sliders,
  ShieldAlert,
} from 'lucide-react';
import { Sidebar } from '@/components/layout/Sidebar';
import { api } from '@/lib/api/client';
import { Profile, Document } from '@/lib/types/database';

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Stats and user data
  const [stats, setStats] = useState({
    totalReadingSeconds: 0,
    documentsCount: 0,
    notesCount: 0,
    bookmarksCount: 0,
    highlightsCount: 0,
  });
  const [favoriteDocs, setFavoriteDocs] = useState<Document[]>([]);
  const [recentDocs, setRecentDocs] = useState<Document[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'favorites' | 'preferences'>('overview');

  useEffect(() => {
    let isMounted = true;

    async function loadProfileData() {
      setLoading(true);
      setErrorMessage(null);
      try {
        const [meRes, progressRes, docsRes, notesRes, bookmarksRes, annotationsRes] = await Promise.allSettled([
          api.auth.getMe(),
          api.readingProgress.list(),
          api.documents.getMine({ limit: 10 }),
          api.notes.list(),
          api.bookmarks.list(),
          api.annotations.list(),
        ]);

        if (!isMounted) return;

        if (meRes.status === 'fulfilled') {
          const userProf = meRes.value.profile;
          setProfile(userProf);
          setFullName(userProf?.full_name || '');
        }

        let totalSeconds = 0;
        if (progressRes.status === 'fulfilled') {
          totalSeconds = progressRes.value.progressList.reduce(
            (acc, curr) => acc + (curr.progress.active_seconds || 0),
            0
          );
        }

        let myDocs: Document[] = [];
        if (docsRes.status === 'fulfilled') {
          myDocs = docsRes.value.documents;
          setRecentDocs(myDocs.slice(0, 4));
        }

        const notesCount = notesRes.status === 'fulfilled' ? notesRes.value.total : 0;
        const bookmarksCount = bookmarksRes.status === 'fulfilled' ? bookmarksRes.value.total : 0;
        const highlightsCount = annotationsRes.status === 'fulfilled' ? annotationsRes.value.total : 0;

        setStats({
          totalReadingSeconds: totalSeconds,
          documentsCount: myDocs.length,
          notesCount,
          bookmarksCount,
          highlightsCount,
        });

        // Also fetch favorites if available
        try {
          const favs = myDocs.filter((d) => d.is_favorite);
          setFavoriteDocs(favs);
        } catch {
          // ignore
        }
      } catch (err: any) {
        if (!isMounted) return;
        setErrorMessage(err.message || 'Failed to load user profile');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadProfileData();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setSaving(true);
    setSaveSuccess(false);
    setErrorMessage(null);

    try {
      const updated = await api.profile.update({
        full_name: fullName.trim(),
      });
      setProfile(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not update profile details');
    } finally {
      setSaving(false);
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

  const formatReadingTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    if (mins < 60) return `${mins} mins`;
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hours}h ${remMins}m`;
  };

  const formatJoinDate = (dateStr?: string) => {
    if (!dateStr) return 'Recently joined';
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: 'calc(100vh - var(--header-height))' }}>
        <Sidebar />
        <main style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-secondary)' }}>
            <Loader2 className="animate-spin" size={24} />
            <span>Loading profile...</span>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - var(--header-height))', width: '100%' }}>
      <Sidebar />

      <main style={{ flex: 1, padding: '2.5rem', maxWidth: '1000px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* Profile Header Card */}
        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-lg)',
            padding: '2rem',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1.5rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: 'var(--bg-tertiary)',
                border: '3px solid var(--accent-primary)',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name || 'User Profile'}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <User size={36} style={{ color: 'var(--accent-primary)' }} />
              )}
            </div>

            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                {profile?.full_name || 'SmartPDF Scholar'}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.9rem', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Mail size={15} />
                  {profile?.email}
                </span>
                <span>•</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Calendar size={15} />
                  Member since {formatJoinDate(profile?.created_at)}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <Link
              href="/settings"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.6rem 1rem',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontWeight: 600,
                fontSize: '0.875rem',
                textDecoration: 'none',
              }}
            >
              <Sliders size={16} />
              <span>Settings</span>
            </Link>

            <button
              type="button"
              onClick={handleSignOut}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.6rem 1rem',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: 'var(--radius-md)',
                color: '#ef4444',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              <LogOut size={16} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-medium)' }}>
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            style={{
              padding: '0.75rem 1.25rem',
              fontWeight: 600,
              fontSize: '0.95rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'overview' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeTab === 'overview' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Overview &amp; Statistics
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('favorites')}
            style={{
              padding: '0.75rem 1.25rem',
              fontWeight: 600,
              fontSize: '0.95rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'favorites' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeTab === 'favorites' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Saved &amp; Favorites ({favoriteDocs.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preferences')}
            style={{
              padding: '0.75rem 1.25rem',
              fontWeight: 600,
              fontSize: '0.95rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'preferences' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeTab === 'preferences' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Account Details
          </button>
        </div>

        {errorMessage && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.85rem 1rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: 'var(--radius-md)',
              color: '#ef4444',
              fontSize: '0.9rem',
            }}
          >
            <AlertCircle size={18} />
            <span>{errorMessage}</span>
          </div>
        )}

        {saveSuccess && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.85rem 1rem',
              background: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.25)',
              borderRadius: 'var(--radius-md)',
              color: '#22c55e',
              fontSize: '0.9rem',
            }}
          >
            <CheckCircle2 size={18} />
            <span>Profile successfully updated!</span>
          </div>
        )}

        {/* Tab 1: Overview & Stats */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
              }}
            >
              <div
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                }}
              >
                <div style={{ padding: '0.75rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: 'var(--radius-sm)', color: '#3b82f6' }}>
                  <Clock size={24} />
                </div>
                <div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {formatReadingTime(stats.totalReadingSeconds)}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Active Reading Time</div>
                </div>
              </div>

              <div
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                }}
              >
                <div style={{ padding: '0.75rem', background: 'rgba(139, 92, 246, 0.1)', borderRadius: 'var(--radius-sm)', color: '#8b5cf6' }}>
                  <BookOpen size={24} />
                </div>
                <div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {stats.documentsCount}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Library PDFs</div>
                </div>
              </div>

              <div
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                }}
              >
                <div style={{ padding: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: 'var(--radius-sm)', color: '#10b981' }}>
                  <FileText size={24} />
                </div>
                <div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {stats.notesCount}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Study Notes</div>
                </div>
              </div>

              <div
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                }}
              >
                <div style={{ padding: '0.75rem', background: 'rgba(245, 158, 11, 0.1)', borderRadius: 'var(--radius-sm)', color: '#f59e0b' }}>
                  <Highlighter size={24} />
                </div>
                <div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {stats.highlightsCount}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Active Highlights</div>
                </div>
              </div>
            </div>

            {/* Recent Documents */}
            <div
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.5rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Recently Studied Documents
                </h2>
                <Link href="/my-library" style={{ fontSize: '0.875rem', color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600 }}>
                  View All &rarr;
                </Link>
              </div>

              {recentDocs.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No documents in your library yet. Explore the{' '}
                  <Link href="/library" style={{ color: 'var(--accent-primary)' }}>
                    Public Library
                  </Link>{' '}
                  to begin studying!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {recentDocs.map((doc) => (
                    <div
                      key={doc.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.85rem 1rem',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-light)',
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <BookOpen size={18} style={{ color: 'var(--accent-primary)' }} />
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                            {doc.title}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {doc.page_count} pages • {(doc.file_size / (1024 * 1024)).toFixed(1)} MB
                          </div>
                        </div>
                      </div>

                      <Link
                        href={`/reader/${doc.id}`}
                        style={{
                          padding: '0.4rem 0.85rem',
                          background: 'var(--accent-primary)',
                          color: '#fff',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          textDecoration: 'none',
                        }}
                      >
                        Open Reader
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Saved & Favorites */}
        {activeTab === 'favorites' && (
          <div
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
            }}
          >
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.25rem' }}>
              Favourite Documents
            </h2>
            {favoriteDocs.length === 0 ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <Heart size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
                <p>You have not marked any documents as favourite yet.</p>
                <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                  Click the heart icon on any document in the library or reader to save it here.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {favoriteDocs.map((doc) => (
                  <div
                    key={doc.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.85rem 1rem',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-light)',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{doc.title}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {doc.categories?.join(', ') || 'General'}
                      </div>
                    </div>
                    <Link
                      href={`/reader/${doc.id}`}
                      style={{
                        padding: '0.4rem 0.85rem',
                        background: 'var(--accent-primary)',
                        color: '#fff',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        textDecoration: 'none',
                      }}
                    >
                      Read Now
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Account Details & Editing */}
        {activeTab === 'preferences' && (
          <div
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.75rem',
            }}
          >
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.5rem' }}>
              Personal Account Information
            </h2>

            <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  Google Account Email (Immutable)
                </label>
                <input
                  type="email"
                  value={profile?.email || ''}
                  disabled
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-muted)',
                    cursor: 'not-allowed',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  Full Display Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your display name"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  Account Role
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.9rem',
                  }}
                >
                  <ShieldAlert size={16} />
                  <span>Standard User Profile (Elevated privileges are server-controlled)</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                style={{
                  alignSelf: 'flex-start',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.5rem',
                  background: 'var(--accent-primary)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                <span>{saving ? 'Saving...' : 'Save Profile Changes'}</span>
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
