import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/services/authService';
import { getDocumentById } from '@/lib/services/documentService';
import { telegramClient } from '@/lib/telegram/client';
import { getVerifiedAdminSession } from '@/lib/auth/adminAuth';
import { parseHttpRange } from '@/lib/pdf/rangeParser';

interface CachedDocAccess {
  fileName: string;
  storageFileId: string;
  isAccessible: boolean;
  expiresAt: number;
}

// In-memory access validation cache (60s TTL) to prevent repeated DB lookups during rapid Range chunk streaming
const docAccessCache = new Map<string, CachedDocAccess>();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase configuration error' }, { status: 503 });
  }

  const now = Date.now();
  const user = await getAuthenticatedUser(supabase);
  const adminSession = await getVerifiedAdminSession();
  const isAdmin = adminSession.valid;
  const cacheKey = `${id}:${user?.id || 'anon'}:${isAdmin ? 'admin' : 'user'}`;

  const cached = docAccessCache.get(cacheKey);
  let fileName: string;
  let fileId: string;

  if (cached && cached.expiresAt > now && cached.isAccessible) {
    fileName = cached.fileName;
    fileId = cached.storageFileId;
  } else {
    const doc = await getDocumentById(supabase, id, user?.id, isAdmin);
    if (!doc) {
      return NextResponse.json({ error: 'Document not found or access denied' }, { status: 404 });
    }

    // Double check publication status for non-owners/non-admins
    const isOwner = user && doc.user_id === user.id;
    const isAccessible =
      (doc.is_public && doc.status === 'published' && !doc.is_trash && !doc.is_deleted) ||
      isOwner ||
      isAdmin;

    if (!isAccessible) {
      return NextResponse.json({ error: 'Document is not published' }, { status: 403 });
    }

    if (!doc.storage_file_id) {
      return NextResponse.json({ error: 'No Telegram file reference associated with document' }, { status: 404 });
    }

    fileName = doc.file_name;
    fileId = doc.storage_file_id;

    // Cache verified access for 60s
    docAccessCache.set(cacheKey, {
      fileName,
      storageFileId: fileId,
      isAccessible: true,
      expiresAt: now + 60000,
    });
  }

  // Retrieve PDF bytes from Telegram Bot API (backed by TelegramStorageClient LRU buffer cache)
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
    'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=3600',
  };

  const rangeResult = parseHttpRange(rangeHeader, totalLength);

  // Return HTTP 416 for unsatisfiable byte ranges (start >= totalLength, end < start, invalid suffix)
  if (rangeResult.status === 416) {
    return new NextResponse(null, {
      status: 416,
      headers: {
        'Content-Range': rangeResult.contentRange || `bytes */${totalLength}`,
        'Accept-Ranges': 'bytes',
        'Content-Type': 'application/pdf',
        'Cache-Control': 'no-cache',
      },
    });
  }

  // Support HTTP 206 Partial Content Range requests (crucial for PDF.js page streaming)
  if (
    rangeResult.status === 206 &&
    rangeResult.start !== undefined &&
    rangeResult.end !== undefined
  ) {
    const chunk = fileBuffer.subarray(rangeResult.start, rangeResult.end + 1);

    headers['Content-Range'] = rangeResult.contentRange!;
    headers['Content-Length'] = String(rangeResult.chunkLength!);

    return new NextResponse(chunk as any, {
      status: 206,
      headers,
    });
  }

  headers['Content-Length'] = String(totalLength);
  return new NextResponse(fileBuffer as any, {
    status: 200,
    headers,
  });
}
