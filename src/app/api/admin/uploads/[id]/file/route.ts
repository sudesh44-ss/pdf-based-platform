import { NextResponse } from 'next/server';
import { getVerifiedAdminSession } from '@/lib/auth/adminAuth';
import { getUploadById } from '@/lib/services/telegramService';
import { telegramClient } from '@/lib/telegram/client';
import { parseHttpRange } from '@/lib/pdf/rangeParser';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getVerifiedAdminSession();
  if (!session.valid) {
    return NextResponse.json({ error: 'Admin authorization required' }, { status: 401 });
  }

  const { id } = await params;
  const upload = await getUploadById(id);
  if (!upload) {
    return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
  }

  const restoreResult = await telegramClient.downloadPdf(upload.telegram_file_id);
  if (!restoreResult.success || !restoreResult.buffer) {
    return NextResponse.json(
      { error: restoreResult.error || 'Failed to download file from Telegram' },
      { status: 502 }
    );
  }

  const fileBuffer = restoreResult.buffer;
  const totalLength = fileBuffer.length;
  const rangeHeader = request.headers.get('range');

  const headers: Record<string, string> = {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="${encodeURIComponent(upload.original_filename)}"`,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, no-cache',
  };

  const rangeResult = parseHttpRange(rangeHeader, totalLength);

  // Return HTTP 416 for unsatisfiable byte ranges
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

  // Return HTTP 206 Partial Content
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
