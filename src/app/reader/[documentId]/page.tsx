'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileX } from 'lucide-react';
import { api } from '@/lib/api/client';
import { Document } from '@/lib/types/database';
import { PdfViewer } from '@/components/reader/PdfViewer';

export default function ReaderPage() {
  const params = useParams();
  const documentId = params?.documentId as string;
  const [doc, setDoc] = useState<Document | null>(null);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    if (documentId) {
      setLoading(true);
      api.documents
        .getById(documentId)
        .then((found) => {
          setDoc(found);
        })
        .catch((err) => {
          console.error('Failed to load document in reader:', err);
          setDoc(null);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [documentId]);

  if (!mounted) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span>Initializing Workspace...</span>
      </div>
    );
  }

  if (!doc) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <FileX size={48} color="var(--accent-danger)" />
        <h2>Document Not Found</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '400px' }}>
          The requested document could not be found or you do not have permission to access it.
        </p>
        <Link
          href="/library"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.6rem 1.25rem',
            background: 'var(--accent-primary)',
            color: '#fff',
            borderRadius: 'var(--radius-sm)',
            fontWeight: 600,
          }}
        >
          <ArrowLeft size={16} />
          <span>Return to Library</span>
        </Link>
      </div>
    );
  }

  return (
    <PdfViewer
      documentId={doc.id}
      documentTitle={doc.title}
      pdfUrl={`/api/documents/${doc.id}/file`}
      initialPage={1}
      totalPages={doc.page_count}
    />
  );
}
