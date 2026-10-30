import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/services/authService';
import { getDocumentById } from '@/lib/services/documentService';
import { telegramClient } from '@/lib/telegram/client';
import { getVerifiedAdminSession } from '@/lib/auth/adminAuth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase configuration error' }, { status: 503 });
  }

  const user = await getAuthenticatedUser(supabase);
  const adminSession = await getVerifiedAdminSession();
  const isAdmin = adminSession.valid;

  const doc = await getDocumentById(supabase, id, user?.id, isAdmin);
  if (!doc) {
    return NextResponse.json({ error: 'Document not found or access denied' }, { status: 404 });
  }

  // Double check publication status for non-owners/non-admins
  const isOwner = user && doc.user_id === user.id;
  const isAccessible = (doc.is_public && doc.status === 'published' && !doc.is_trash) || isOwner || isAdmin;

  if (!isAccessible) {
    return NextResponse.json({ error: 'Document is not published' }, { status: 403 });
  }

  const fileId = doc.storage_file_id;
  if (!fileId) {
    return NextResponse.json({ error: 'No Telegram file reference associated with document' }, { status: 404 });
  }

  // Retrieve PDF bytes from Telegram Bot API
  const restoreResult = await telegramClient.downloadPdf(fileId);
  if (!restoreResult.success || !restoreResult.buffer) {
    return NextResponse.json(
      { error: restoreResult.error || 'Failed to retrieve PDF file from Telegram' },
      { status: 502 }
    );
  }

  const fileBuffer = restoreResult.buffer;
  const totalLength = fileBuffer.length;
  const rangeHeader = request.headers.get('range');

  const headers: Record<string, string> = {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="${encodeURIComponent(doc.file_name)}"`,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=3600',
  };

  // Support HTTP 206 Partial Content Range requests (crucial for PDF.js page streaming)
  if (rangeHeader && rangeHeader.startsWith('bytes=')) {
    const parts = rangeHeader.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : totalLength - 1;

    if (!isNaN(start) && start < totalLength) {
      const safeEnd = Math.min(end, totalLength - 1);
      const chunkSize = safeEnd - start + 1;
      const chunk = fileBuffer.subarray(start, safeEnd + 1);

      headers['Content-Range'] = `bytes ${start}-${safeEnd}/${totalLength}`;
      headers['Content-Length'] = String(chunkSize);

      return new NextResponse(chunk as any, {
        status: 206,
        headers,
      });
    }
  }

  headers['Content-Length'] = String(totalLength);
  return new NextResponse(fileBuffer as any, {
    status: 200,
    headers,
  });
}
