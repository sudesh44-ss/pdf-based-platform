import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  TELEGRAM_CHANNEL_OR_CHAT_ID: z.string().min(1).optional(),
  TELEGRAM_API_BASE_URL: z.string().url().default('https://api.telegram.org'),
  MAX_UPLOAD_BYTES: z.coerce.number().default(104857600), // 100 MB
  OCR_MAX_PAGES_PER_JOB: z.coerce.number().default(25),
  OCR_DEFAULT_LANGUAGE: z.string().default('eng'),
  ADMIN_EMAILS: z.string().default('admin@example.com'),
});

export const env = envSchema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHANNEL_OR_CHAT_ID: process.env.TELEGRAM_CHANNEL_OR_CHAT_ID,
  TELEGRAM_API_BASE_URL: process.env.TELEGRAM_API_BASE_URL,
  MAX_UPLOAD_BYTES: process.env.MAX_UPLOAD_BYTES,
  OCR_MAX_PAGES_PER_JOB: process.env.OCR_MAX_PAGES_PER_JOB,
  OCR_DEFAULT_LANGUAGE: process.env.OCR_DEFAULT_LANGUAGE,
  ADMIN_EMAILS: process.env.ADMIN_EMAILS,
});
