import { NextResponse } from 'next/server';
import { getVerifiedAdminSession } from '@/lib/auth/adminAuth';
import { getUploadById } from '@/lib/services/telegramService';
import { telegramClient } from '@/lib/telegram/client';

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
