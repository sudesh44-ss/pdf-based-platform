import React from 'react';
import Link from 'next/link';

export default function TermsPage() {
  return (
    <main style={{ maxWidth: '850px', margin: '0 auto', padding: '3.5rem 1.5rem', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
      <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>
        Terms and Conditions
      </h1>
      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '2.5rem' }}>
        Last Revised: October 2026 &bull; User Agreement
      </p>

      <section style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            1. Acceptance of Terms
          </h2>
          <p>
            By accessing or using the SmartPDF platform (&ldquo;Service&rdquo;), you agree to be bound by these Terms and Conditions. If you disagree with any portion of these terms, you must not use the platform.
          </p>
        </div>

        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            2. Permitted Use &amp; Rights Declaration
          </h2>
          <p>
            You agree to upload only documents that you own, have created, or hold the lawful rights, licenses, or open-access permissions to store and redistribute. You must not upload copyrighted works without authorization, pirated books, malicious binaries disguised as PDFs, or prohibited materials.
          </p>
        </div>

        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            3. File Upload &amp; Format Specifications
          </h2>
          <p>
            The platform enforces a strict maximum file size of <strong>100 MB</strong> per PDF document. All uploads are subject to binary header inspection for <code style={{ color: 'var(--accent-primary)' }}>%PDF-</code> magic bytes. Malformed, corrupted, or encrypted documents may be rejected automatically.
          </p>
        </div>

        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            4. Code Magnification and Content Disclaimer
          </h2>
          <p>
            Code magnification and reading features are provided on an &ldquo;as-is&rdquo; basis for study convenience. The platform does not guarantee typographic or syntactic accuracy of third-party document content.
          </p>
        </div>

        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            5. Termination &amp; Moderation
          </h2>
          <p>
            We reserve the right to remove any content reported for copyright infringement or violation of these terms, and to suspend or terminate accounts engaging in abusive behavior. Please review our <Link href="/copyright" style={{ color: 'var(--accent-primary)' }}>Copyright Policy</Link> for DMCA procedures.
          </p>
        </div>
      </section>
    </main>
  );
}
