import { NextResponse } from 'next/server';
import { storageEngine } from '@/lib/store/storageEngine';
import { telegramBackupSchema } from '@/lib/validation/schemas';
import { telegramClient } from '@/lib/telegram/client';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = telegramBackupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { document_ids, destination } = parsed.data;

    // Create backup job
    const job = storageEngine.createBackupJob(document_ids.length, destination);

    return NextResponse.json({
      success: true,
      job,
      message: `Archiving ${document_ids.length} documents to Telegram destination.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Telegram backup failed' }, { status: 500 });
  }
}
