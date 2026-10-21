import React from 'react';
import Link from 'next/link';
import { ShieldAlert, Mail } from 'lucide-react';

export default function CopyrightPage() {
  return (
    <main style={{ maxWidth: '850px', margin: '0 auto', padding: '3.5rem 1.5rem', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
        <ShieldAlert size={28} color="var(--accent-danger)" />
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
          Copyright &amp; DMCA Removal Policy
        </h1>
      </div>
      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '2.5rem' }}>
        Takedown Notice &bull; Digital Millennium Copyright Act Compliance
      </p>

      <section style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            1. Commitment to Intellectual Property
          </h2>
          <p>
            SmartPDF respects the intellectual property rights of authors, publishers, and creators. We enforce a zero-tolerance policy regarding willful copyright infringement. All submitted public materials require positive affirmation of redistribution rights from the submitter and are subject to immediate takedown upon receipt of a valid infringement notice.
          </p>
        </div>

        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            2. Notice and Takedown Procedure
          </h2>
          <p>
            If you are a copyright owner, or authorized to act on behalf of one, and believe in good faith that a document hosted or linked through our catalog infringes your copyright, you may submit a formal notification containing:
          </p>
          <ol style={{ paddingLeft: '1.5rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <li>Identification of the copyrighted work claimed to have been infringed (title, author, publisher).</li>
            <li>Identification of the material that is claimed to be infringing, including the specific document URL on our site (e.g. <code style={{ color: 'var(--accent-primary)' }}>/library/[documentId]</code>).</li>
            <li>Your contact information: full name, address, telephone number, and email address.</li>
            <li>A statement that you have a good faith belief that use of the material is not authorized by the copyright owner, its agent, or the law.</li>
            <li>A statement made under penalty of perjury that the information provided is accurate and that you are authorized to act on behalf of the owner.</li>
            <li>Your physical or electronic signature.</li>
          </ol>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Mail size={18} color="var(--accent-primary)" />
            <span>Designated Agent Contact</span>
          </h3>
          <p style={{ fontSize: '0.875rem' }}>
            Submit copyright infringement notifications directly to:
          </p>
          <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--accent-primary)', marginTop: '0.25rem' }}>
            dmca-agent@smartpdf-platform.local
          </p>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            Alternatively, click the &ldquo;Report&rdquo; button directly on any document details page to queue the document for priority moderation review.
          </p>
        </div>

        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            3. Response &amp; Removal Timeline
          </h2>
          <p>
            Upon receiving a bona fide infringement notification, we will expeditiously remove or disable access to the infringing material and notify the user who submitted the file. Repeat infringers will have their accounts terminated and IP addresses restricted.
          </p>
        </div>
      </section>
    </main>
  );
}
