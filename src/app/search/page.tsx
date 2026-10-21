'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Search as SearchIcon,
  BookOpen,
  ScanText,
  FileText,
  ArrowRight,
  Info,
} from 'lucide-react';
import { storageEngine } from '@/lib/store/storageEngine';
import { Document } from '@/lib/types/database';
import { Sidebar } from '@/components/layout/Sidebar';

interface SearchResultMatch {
  doc: Document;
  pageNumber: number;
  snippet: string;
  isOcr: boolean;
}

export default function SearchPage() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResultMatch[]>([]);
  const [searched, setSearched] = useState(false);

  const performSearch = (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }

    const lower = q.toLowerCase();
    const docs = storageEngine.getDocuments({ isPublic: true });
    const matches: SearchResultMatch[] = [];

    // Simulated OCR & Native text index
    const ocrCorpus: Record<string, { page: number; text: string }[]> = {
      'doc-dist-sys-01': [
        { page: 1, text: 'Distributed systems are composed of autonomous computing entities that communicate over asynchronous networks. CAP Theorem consistency and availability.' },
        { page: 2, text: 'A Raft cluster consists of several servers; typically 5, allowing the system to tolerate 2 failures. Leader election invariants and AppendEntries RPCs.' },
        { page: 3, text: 'Distributed Lock implementation in TypeScript. Lease management and fencing tokens to prevent split-brain execution.' },
        { page: 4, text: 'The Saga pattern breaks a distributed transaction into a sequence of local transactions with compensating undo actions.' },
        { page: 5, text: 'Decentralized document archiving using Telegram Cloud Bot API tier with SHA-256 cryptographic verification.' },
      ],
      'doc-react-ts-02': [
        { page: 1, text: 'React concurrent mode and fiber tree reconciliation algorithms with prioritized lanes.' },
        { page: 2, text: 'Dual-buffering architecture: current tree vs workInProgress tree in memory.' },
        { page: 3, text: 'Lane priority bitmasks and scheduling cooperative multitasking.' },
      ],
    };

    docs.forEach((doc) => {
      // 1. Check title and description
      if (doc.title.toLowerCase().includes(lower) || (doc.description && doc.description.toLowerCase().includes(lower))) {
        matches.push({
          doc,
          pageNumber: 1,
          snippet: doc.description || doc.title,
          isOcr: false,
        });
      }

      // 2. Check OCR index
      const pages = ocrCorpus[doc.id] || [];
      pages.forEach((p) => {
        if (p.text.toLowerCase().includes(lower)) {
          matches.push({
            doc,
            pageNumber: p.page,
            snippet: p.text,
            isOcr: true,
          });
        }
      });
    });

    setResults(matches);
    setSearched(true);
  };

  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery);
    }
  }, [initialQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query);
  };

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - var(--header-height))', width: '100%' }}>
      <Sidebar />

      <main style={{ flex: 1, padding: '2.5rem', maxWidth: '1100px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>Combined Native &amp; OCR Search</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.25rem' }}>
            Query searchable PDF vectors, scanned screenshot text, and study notes simultaneously.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ position: 'relative', width: '100%' }}>
          <SearchIcon size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search keywords, e.g. 'Raft', 'Lock', 'Saga', 'Lanes', 'CAP'..."
            style={{
              width: '100%',
              height: '52px',
              padding: '0 1rem 0 3rem',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-lg)',
              fontSize: '1.05rem',
              color: 'var(--text-primary)',
              boxShadow: 'var(--shadow-sm)',
            }}
          />
        </form>

        {/* Quick query chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Suggestions:</span>
          {['Raft', 'Consensus', 'Lock', 'Saga', 'Telegram', 'Fiber', 'Index'].map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => { setQuery(term); performSearch(term); }}
              style={{
                padding: '0.25rem 0.65rem',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.78rem',
                color: 'var(--text-secondary)',
              }}
            >
              {term}
            </button>
          ))}
        </div>

        {/* OCR Accuracy Disclaimer */}
        <div
          style={{
            padding: '0.85rem 1.25rem',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            fontSize: '0.825rem',
            color: 'var(--text-muted)',
          }}
        >
          <Info size={15} color="var(--accent-warning)" style={{ flexShrink: 0 }} />
          <span>
            OCR Disclaimer: Optical Character Recognition is experimental and accuracy varies on low-resolution mobile screenshots. Code extracted from screenshots is not verified source code.
          </span>
        </div>

        {/* Results */}
        {searched && (
          <section>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>
              Search Results ({results.length} matches found)
            </h2>

            {results.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)' }}>
                No occurrences found for &ldquo;{query}&rdquo;. Try another technical term or topic keyword.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {results.map((res, idx) => (
                  <div
                    key={`${res.doc.id}-${res.pageNumber}-${idx}`}
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.6rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <BookOpen size={16} color="var(--accent-primary)" />
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {res.doc.title}
                        </h3>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            padding: '0.15rem 0.45rem',
                            borderRadius: 'var(--radius-full)',
                            background: res.isOcr ? 'var(--accent-secondary-light)' : 'var(--accent-primary-light)',
                            color: res.isOcr ? 'var(--accent-secondary)' : 'var(--accent-primary)',
                            fontWeight: 600,
                          }}
                        >
                          {res.isOcr ? 'OCR Extracted Page Match' : 'Metadata Match'}
                        </span>
                      </div>

                      <Link
                        href={`/reader/${res.doc.id}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.35rem 0.75rem',
                          background: 'var(--accent-primary)',
                          color: '#fff',
                          borderRadius: 'var(--radius-xs)',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                        }}
                      >
                        <span>Jump to Page {res.pageNumber}</span>
                        <ArrowRight size={13} />
                      </Link>
                    </div>

                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5, background: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: 'var(--radius-xs)', borderLeft: '3px solid var(--accent-primary)' }}>
                      &ldquo;{res.snippet}&rdquo;
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
