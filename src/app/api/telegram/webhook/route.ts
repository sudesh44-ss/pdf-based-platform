import crypto from 'crypto';
import { NextResponse } from 'next/server';
import {
  isChatIdAllowed,
  registerTelegramUpload,
  TelegramWebhookDocData,
} from '@/lib/services/telegramService';

export async function POST(request: Request) {
  // 1. Verify Telegram Webhook Secret Token (timing-safe)
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expectedSecret) {
    const receivedSecret = request.headers.get('x-telegram-bot-api-secret-token') || '';
    const expectedBuf = Buffer.from(expectedSecret);
    const receivedBuf = Buffer.from(receivedSecret);
    if (
      expectedBuf.length !== receivedBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, receivedBuf)
    ) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized webhook secret token' },
        { status: 401 }
      );
    }
  }

  let update: any;
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Malformed JSON payload' }, { status: 400 });
  }

  // Handle standard message or channel_post
  const msg = update.message || update.channel_post;
  if (!msg) {
    // Non-message update (e.g., callback_query, my_chat_member) -> acknowledge with 200
    return NextResponse.json({ ok: true, ignored: true, reason: 'No message payload' });
  }

  const chatId = msg.chat?.id;
  const chatTitle = msg.chat?.title || msg.chat?.username || 'Private Chat';
  const messageId = msg.message_id;

  // 2. Validate Chat ID against allowlist
  if (!isChatIdAllowed(chatId)) {
    console.warn(`Telegram message from unauthorized chat ID: ${chatId}`);
    return NextResponse.json({ ok: true, ignored: true, reason: 'Unauthorized chat ID' });
  }

  // 3. Inspect document payload
  const doc = msg.document;
  if (!doc) {
    // Regular text message or other media -> acknowledge without processing
    return NextResponse.json({ ok: true, ignored: true, reason: 'Not a document' });
  }

  const fileName = doc.file_name || 'document.pdf';
  const mimeType = doc.mime_type || 'application/pdf';
  const isPdf =
    mimeType.toLowerCase() === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');

  if (!isPdf) {
    return NextResponse.json({
      ok: true,
      ignored: true,
      reason: `Unsupported MIME type: ${mimeType}`,
    });
  }

  // 4. Safely extract sender information for unauthenticated audit logging
  const sender = msg.from
    ? {
        id: msg.from.id,
        is_bot: msg.from.is_bot,
        first_name: msg.from.first_name,
        last_name: msg.from.last_name,
        username: msg.from.username,
      }
    : undefined;

  // Construct payload and ingest
  const docData: TelegramWebhookDocData = {
    chatId,
    messageId,
    fileId: doc.file_id,
    fileUniqueId: doc.file_unique_id,
    fileName,
    fileSize: doc.file_size || 0,
    mimeType,
    caption: msg.caption || '',
    chatTitle,
    sender,
  };

  const result = await registerTelegramUpload(docData);

  if (!result.success) {
    return NextResponse.json(
      { ok: false, error: result.error || 'Failed to register upload' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    upload_id: result.upload?.id,
    is_duplicate: result.isDuplicate,
    status: result.upload?.status,
  });
}
