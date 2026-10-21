import { NextResponse } from 'next/server';
import { telegramClient } from '@/lib/telegram/client';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get('file_id') || 'tg_file_dist_sys_01';

  const result = await telegramClient.downloadPdf(fileId);

  if (!result.success || !result.buffer) {
    return NextResponse.json({ error: result.error || 'Failed to download from Telegram' }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(result.buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="restored-document.pdf"',
      'X-Telegram-SHA256': result.sha256 || '',
    },
  });
}
