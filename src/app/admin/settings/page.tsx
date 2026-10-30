'use client';

import React, { useState } from 'react';
import {
  Settings,
  Shield,
  Bot,
  Key,
  Database,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';

export default function AdminSettingsPage() {
  const [testPassword, setTestPassword] = useState('');
  const [generatedHash, setGeneratedHash] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerateHash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPassword) return;

    // Call helper endpoint or compute hash
    try {
      const res = await fetch('/api/admin/auth/hash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: testPassword }),
      });
      const data = await res.json();
      if (data.data?.hash) {
        setGeneratedHash(data.data.hash);
      }
    } catch {
      setGeneratedHash('Error generating hash');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AdminLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '900px' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            System &amp; Pipeline Configuration
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', marginTop: '0.35rem' }}>
            Verify Telegram integration parameters, cloud delivery constraints, and security hashes.
          </p>
        </div>

        {/* Telegram Configuration Overview */}
        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ padding: '0.5rem', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderRadius: '8px' }}>
              <Bot size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Telegram Bot API Gateway
              </h2>
              <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                Primary ingestion channel for PDF manuscripts and study materials.
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div style={{ padding: '1rem', background: 'var(--bg-primary)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>TELEGRAM WEBHOOK</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                <code>/api/telegram/webhook</code>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#22c55e', marginTop: '0.35rem' }}>
                Protected by X-Telegram-Bot-Api-Secret-Token
              </div>
            </div>

            <div style={{ padding: '1rem', background: 'var(--bg-primary)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>MAX FILE DOWNLOAD LIMIT</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                20.00 MB (Telegram Cloud API)
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                Larger files require a Local Bot API Server
              </div>
            </div>
          </div>
        </div>

        {/* Admin Password Hash Utility */}
        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ padding: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '8px' }}>
              <Key size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Generate Admin Password Hash
              </h2>
              <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                Derive a safe scrypt hash for setting <code>ADMIN_PASSWORD_HASH</code> in Vercel.
              </div>
            </div>
          </div>

          <form onSubmit={handleGenerateHash} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Enter desired admin password..."
              value={testPassword}
              onChange={(e) => setTestPassword(e.target.value)}
              style={{
                flex: 1,
                minWidth: '240px',
                padding: '0.75rem',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
              }}
            />
            <button
              type="submit"
              style={{
                padding: '0.75rem 1.25rem',
                background: 'var(--accent-primary)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Generate Hash
            </button>
          </form>

          {generatedHash && (
            <div style={{ padding: '1rem', background: 'var(--bg-primary)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
              <code style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', wordBreak: 'break-all' }}>
                {generatedHash}
              </code>
              <button
                type="button"
                onClick={() => copyToClipboard(generatedHash)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.45rem 0.75rem',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  flexShrink: 0,
                }}
              >
                {copied ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
