'use client';

import React, { useState } from 'react';
import { Mail, MessageSquare, Send, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '@/lib/api/client';

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('general');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.contact.send({ name, email, subject, message });
      setNotice(res.notice || null);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Failed to submit contact request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: '750px', margin: '0 auto', padding: '3.5rem 1.5rem', width: '100%' }}>
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>Contact Support</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginTop: '0.5rem' }}>
          Have feedback on the PDF reader, report a bug, or inquire about Telegram storage integration?
        </p>
      </div>

      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          padding: '2.5rem',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        {submitted ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <CheckCircle2 size={48} color="var(--accent-success)" />
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>Message Received</h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '400px' }}>
              Thank you for contacting us, {name}. Our engineering and support team will respond within 24 to 48 hours.
            </p>
            {notice && (
              <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', maxWidth: '440px', background: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                {notice}
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label htmlFor="contactNameInput" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
                  Your Name
                </label>
                <input
                  id="contactNameInput"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ada Lovelace"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                  }}
                />
              </div>

              <div>
                <label htmlFor="contactEmailInput" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
                  Email Address
                </label>
                <input
                  id="contactEmailInput"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ada@example.com"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                  }}
                />
              </div>
            </div>

            <div>
              <label htmlFor="contactTopicSelect" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
                Topic / Inquiry
              </label>
              <select
                id="contactTopicSelect"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                }}
              >
                <option value="general">General Inquiry &amp; Feedback</option>
                <option value="telegram">Telegram Bot Cloud Storage Setup</option>
                <option value="reader">Reader Enhancement Suggestion</option>
                <option value="copyright">Copyright / DMCA Notice</option>
                <option value="bug">Bug Report / Defect</option>
              </select>
            </div>

            <div>
              <label htmlFor="contactMessageInput" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
                Message
              </label>
              <textarea
                id="contactMessageInput"
                rows={5}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your question or issue in detail..."
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  resize: 'vertical',
                }}
              />
            </div>

            <button
              type="submit"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.85rem 1.75rem',
                background: 'var(--accent-primary)',
                color: '#fff',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 600,
                fontSize: '0.95rem',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Send size={16} />
              <span>Send Message</span>
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
