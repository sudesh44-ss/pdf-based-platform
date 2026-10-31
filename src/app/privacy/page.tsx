import React from 'react';
import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: '850px', margin: '0 auto', padding: '3.5rem 1.5rem', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
      <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>
        Privacy Policy
      </h1>
      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '2.5rem' }}>
        Effective Date: October 2026 &bull; Transparency Notice
      </p>

      <section style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            1. Overview &amp; Architecture
          </h2>
          <p>
            SmartPDF operates as a client-first digital library and study environment. We minimize server data collection by running core PDF.js canvas rendering, image cropping, and client-side document viewing locally within your web browser.
          </p>
        </div>

        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            2. Information We Process
          </h2>
          <p>
            When using our platform, the following data may be processed:
          </p>
          <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
            <li><strong>Authentication Data:</strong> When signing in with Google OAuth, we receive your email address, unique user ID, and avatar URL provided by Google Identity Services via Supabase Auth.</li>
            <li><strong>User Content:</strong> Uploaded PDF files, study notes created in Tiptap, bookmarks, and reading progress telemetry.</li>
            <li><strong>Telemetry:</strong> Active reading seconds (measured strictly while the reader window is focused) and page progress percentage.</li>
          </ul>
        </div>

        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            3. Third-Party Services &amp; Telegram Cloud Storage
          </h2>
          <p>
            Our architecture utilizes verified third-party cloud infrastructure:
          </p>
          <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
            <li><strong>Telegram Bot API:</strong> Accepted public library PDFs and user-requested backups are stored as documents in Telegram channels managed by our bot. Telegram handles file persistence according to its public terms. Bot tokens and server credentials remain strictly on the backend.</li>
            <li><strong>Supabase:</strong> Provides encrypted PostgreSQL database storage and session authentication.</li>
          </ul>
        </div>

        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            4. Data Retention and Deletion
          </h2>
          <p>
            You retain complete ownership over personal files. When you delete a private PDF or move it to trash, it becomes unlisted immediately. You may permanently delete private files and notes at any time from your dashboard or settings.
          </p>
        </div>

        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            5. Contact Us
          </h2>
          <p>
            For privacy inquiries or data removal requests, please visit our <Link href="/contact" style={{ color: 'var(--accent-primary)' }}>Contact Page</Link>.
          </p>
        </div>
      </section>
    </main>
  );
}
