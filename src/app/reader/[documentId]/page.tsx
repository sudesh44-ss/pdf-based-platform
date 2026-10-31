'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api/client';
import { PdfViewer } from '@/components/reader/PdfViewer';

export default function ReaderPage() {
  const params = useParams();
  const documentId = params?.documentId as string;
  const [docTitle, setDocTitle] = useState<string>('Technical Document');

  // Fetch document title in parallel with PDF download to eliminate sequential loading waterfalls
  useEffect(() => {
    if (documentId) {
      api.documents
        .getById(documentId)
        .then((found) => {
          if (found?.title) setDocTitle(found.title);
        })
        .catch(() => {});
    }
  }, [documentId]);

  if (!documentId) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span>Opening Document...</span>
      </div>
    );
  }

  return (
    <PdfViewer
      documentId={documentId}
      documentTitle={docTitle}
      pdfUrl={`/api/documents/${documentId}/file`}
    />
  );
}
