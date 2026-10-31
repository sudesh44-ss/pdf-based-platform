#!/usr/bin/env node

/**
 * OpenShelf — Telegram Webhook Management CLI
 *
 * Usage:
 *   node scripts/register-webhook.mjs --info
 *   node scripts/register-webhook.mjs --register https://your-domain.vercel.app
 *   node scripts/register-webhook.mjs --delete
 */

import fs from 'fs';
import path from 'path';

// Load environment variables from .env if present
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const rawLine of lines) {
      const line = rawLine.trim().replace(/^#\s*/, ''); // Support commented lines in template
      if (!line || line.startsWith('#') || !line.includes('=')) continue;
      const idx = line.indexOf('=');
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      if (!process.env[key] && val) {
        process.env[key] = val;
      }
    }
  }
}

loadEnv();

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
const apiBase = process.env.TELEGRAM_API_BASE_URL || 'https://api.telegram.org';

if (!botToken || botToken.includes('123456789:ABC')) {
  console.error('\x1b[31m[ERROR] TELEGRAM_BOT_TOKEN is not configured in environment or .env\x1b[0m');
  process.exit(1);
}

const args = process.argv.slice(2);
const command = args[0] || '--info';

async function getWebhookInfo() {
  console.log('\n--- Fetching Telegram Webhook Status ---');
  try {
    const res = await fetch(`${apiBase}/bot${botToken}/getWebhookInfo`);
    const data = await res.json();
    if (!data.ok) {
      console.error('\x1b[31mTelegram API error:\x1b[0m', data.description);
      return;
    }
    console.log('\x1b[32mWebhook Status:\x1b[0m');
    console.log('  URL:                ', data.result.url || '(none - webhook is NOT set)');
    console.log('  Custom Cert:        ', data.result.has_custom_certificate);
    console.log('  Pending Updates:    ', data.result.pending_update_count);
    console.log('  Last Error Date:    ', data.result.last_error_date ? new Date(data.result.last_error_date * 1000).toISOString() : 'None');
    console.log('  Last Error Message: ', data.result.last_error_message || 'None');
    console.log('  Allowed Updates:    ', data.result.allowed_updates || 'All');
  } catch (err) {
    console.error('\x1b[31mNetwork error fetching webhook info:\x1b[0m', err.message);
  }
}

async function registerWebhook(targetBaseUrl) {
  if (!targetBaseUrl) {
    console.error('\x1b[31m[ERROR] Missing target URL. Usage: node scripts/register-webhook.mjs --register https://your-deployment.vercel.app\x1b[0m');
    process.exit(1);
  }

  const cleanBase = targetBaseUrl.replace(/\/+$/, '');
  const webhookUrl = `${cleanBase}/api/telegram/webhook`;

  console.log(`\n--- Registering Telegram Webhook ---`);
  console.log(`Destination Endpoint: ${webhookUrl}`);
  console.log(`Allowed Updates:      message, channel_post`);
  console.log(`Secret Header:        ${webhookSecret ? '(configured)' : '(none)'}`);

  const payload = {
    url: webhookUrl,
    allowed_updates: ['message', 'channel_post'],
    drop_pending_updates: false,
  };

  if (webhookSecret) {
    payload.secret_token = webhookSecret;
  }

  try {
    const res = await fetch(`${apiBase}/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!data.ok) {
      console.error('\x1b[31m[FAILED] Telegram rejected webhook registration:\x1b[0m', data.description);
      process.exit(1);
    }

    console.log('\x1b[32m[SUCCESS] Webhook registered successfully!\x1b[0m');
    console.log(data.description || 'Webhook was set');
    await getWebhookInfo();
  } catch (err) {
    console.error('\x1b[31mNetwork error registering webhook:\x1b[0m', err.message);
    process.exit(1);
  }
}

async function deleteWebhook() {
  console.log('\n--- Deleting Telegram Webhook ---');
  try {
    const res = await fetch(`${apiBase}/bot${botToken}/deleteWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drop_pending_updates: false }),
    });

    const data = await res.json();
    if (!data.ok) {
      console.error('\x1b[31m[FAILED] Failed to delete webhook:\x1b[0m', data.description);
      return;
    }

    console.log('\x1b[32m[SUCCESS] Webhook deleted successfully.\x1b[0m');
    await getWebhookInfo();
  } catch (err) {
    console.error('\x1b[31mNetwork error deleting webhook:\x1b[0m', err.message);
  }
}

switch (command) {
  case '--info':
  case '-i':
    getWebhookInfo();
    break;
  case '--register':
  case '-r':
    registerWebhook(args[1] || process.env.NEXT_PUBLIC_APP_URL);
    break;
  case '--delete':
  case '-d':
    deleteWebhook();
    break;
  default:
    console.log('Usage: node scripts/register-webhook.mjs [--info | --register <URL> | --delete]');
}
