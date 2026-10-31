'use client';

import React from 'react';
import Link from 'next/link';
import {
  HelpCircle,
  Crop,
  Code2,
  BookOpen,
  FileEdit,
  HardDrive,
  Keyboard,
  Shield,
} from 'lucide-react';
import { Sidebar } from '@/components/layout/Sidebar';

export default function HelpPage() {
  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - var(--header-height))', width: '100%' }}>
      <Sidebar />

      <main style={{ flex: 1, padding: '2.5rem', maxWidth: '900px', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>Documentation &amp; User Guides</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginTop: '0.35rem' }}>
            Everything you need to master Smart Crop View, Code Focus Mode, native PDF search, and Telegram channel publishing.
          </p>
        </div>

        {/* Keyboard Shortcuts Table */}
        <section
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
            <Keyboard size={20} color="var(--accent-primary)" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Reader Keyboard Shortcuts</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-xs)' }}>
              <span>Next Page</span>
              <kbd style={{ background: 'var(--bg-card)', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid var(--border-medium)', fontFamily: 'var(--font-mono)' }}>Right Arrow / PageDown</kbd>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-xs)' }}>
              <span>Previous Page</span>
              <kbd style={{ background: 'var(--bg-card)', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid var(--border-medium)', fontFamily: 'var(--font-mono)' }}>Left Arrow / PageUp</kbd>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-xs)' }}>
              <span>Zoom In / Out</span>
              <kbd style={{ background: 'var(--bg-card)', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid var(--border-medium)', fontFamily: 'var(--font-mono)' }}>+ / -</kbd>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-xs)' }}>
              <span>Toggle Smart Crop</span>
              <kbd style={{ background: 'var(--bg-card)', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid var(--border-medium)', fontFamily: 'var(--font-mono)' }}>C</kbd>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-xs)' }}>
              <span>Toggle Fullscreen</span>
              <kbd style={{ background: 'var(--bg-card)', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid var(--border-medium)', fontFamily: 'var(--font-mono)' }}>F</kbd>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-xs)' }}>
              <span>Bookmark Page</span>
              <kbd style={{ background: 'var(--bg-card)', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid var(--border-medium)', fontFamily: 'var(--font-mono)' }}>B</kbd>
            </div>
          </div>
        </section>

        {/* Feature Guides */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Crop size={18} color="var(--accent-warning)" />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Smart Screenshot Reading Mode</h3>
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Screenshots taken from smartphones or tablets frequently contain battery status icons, navigation bars, and distracting borders. By clicking the Crop icon or pressing <kbd>C</kbd>, you can activate <strong>Smart Crop View</strong>. Use the Mobile or Desktop presets to instantly trim outer margins, or drag sliders to isolate specific content blocks. You can return to <strong>Original View</strong> at any moment with one click.
            </p>
          </div>

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Code2 size={18} color="var(--accent-primary)" />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Code Focus Mode</h3>
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Code Focus Mode provides an isolated magnifier specifically tuned for code editors, terminals, and intricate architecture diagrams. It applies specialized contrast enhancing and color inversion filters to clarify dark-mode screenshots. Note: Digital viewport zoom does not fabricate native camera or display resolution.
            </p>
          </div>

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BookOpen size={18} color="var(--accent-secondary)" />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>High-Fidelity PDF Text Search</h3>
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              OpenShelf provides native PDF.js text selection and search capabilities. Select and copy text on any document page with high fidelity.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
