import { z } from 'zod';

/**
 * Client-accessible environment variables.
 * Only variables prefixed with NEXT_PUBLIC_ may appear here.
 */
export const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
});

/**
 * Server-only environment variables.
 * These contain secrets and credentials and MUST NEVER be sent to client bundles.
 */
export const serverOnlyEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  ADMIN_USERNAME: z.string().min(1).default('admin'),
  ADMIN_PASSWORD_HASH: z.string().min(1).optional(),
  ADMIN_SESSION_SECRET: z
    .string()
    .min(16, 'ADMIN_SESSION_SECRET must be at least 16 characters for HMAC security')
    .default('smartpdf-admin-secret-key-default-salt-32b'),
  ADMIN_SESSION_DURATION_HOURS: z.coerce.number().int().positive().default(8),
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1).optional(),
  TELEGRAM_ALLOWED_CHAT_IDS: z.string().optional(),
  TELEGRAM_CHANNEL_OR_CHAT_ID: z.string().optional(),
  TELEGRAM_API_BASE_URL: z.string().url().default('https://api.telegram.org'),
  MAX_UPLOAD_BYTES: z.coerce.number().default(104857600), // 100 MB
  ADMIN_EMAILS: z.string().default('admin@example.com'),
});

/**
 * Combined server environment schema.
 */
export const serverEnvSchema = clientEnvSchema.merge(serverOnlyEnvSchema);

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

const isServer = typeof window === 'undefined';

// Parse public client variables safely
export const clientEnv: ClientEnv = clientEnvSchema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

// Parse server variables if in server environment
export const serverEnv: ServerEnv | null = isServer
  ? serverEnvSchema.parse({
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      ADMIN_USERNAME: process.env.ADMIN_USERNAME,
      ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
      ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
      ADMIN_SESSION_DURATION_HOURS: process.env.ADMIN_SESSION_DURATION_HOURS,
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
      TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET,
      TELEGRAM_ALLOWED_CHAT_IDS: process.env.TELEGRAM_ALLOWED_CHAT_IDS,
      TELEGRAM_CHANNEL_OR_CHAT_ID: process.env.TELEGRAM_CHANNEL_OR_CHAT_ID,
      TELEGRAM_API_BASE_URL: process.env.TELEGRAM_API_BASE_URL,
      MAX_UPLOAD_BYTES: process.env.MAX_UPLOAD_BYTES,
      ADMIN_EMAILS: process.env.ADMIN_EMAILS,
    })
  : null;

/**
 * Centralized env accessor:
 * - On server: returns validated serverEnv.
 * - In browser: returns only validated clientEnv properties. If code accidentally
 *   attempts to access server-only secrets on the client, it returns undefined and logs a security warning.
 */
export const env: ServerEnv = new Proxy({} as ServerEnv, {
  get(_target, prop: string) {
    if (!isServer) {
      if (prop in clientEnv) {
        return (clientEnv as any)[prop];
      }
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          `[Security Warning] Prevented browser access to server-only environment variable: "${prop}".`
        );
      }
      return undefined;
    }
    return serverEnv ? (serverEnv as any)[prop] : undefined;
  },
});

export interface ProductionEnvStatus {
  valid: boolean;
  missingVariables: string[];
  warnings: string[];
}

/**
 * Diagnostic utility to verify that all production requirements are satisfied
 * without ever exposing actual secret values in error messages or logs.
 */
export function validateProductionEnv(): ProductionEnvStatus {
  const missingVariables: string[] = [];
  const warnings: string[] = [];

  // 1. Supabase public credentials
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    missingVariables.push('NEXT_PUBLIC_SUPABASE_URL');
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    missingVariables.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  // 2. Supabase server-only service-role
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    missingVariables.push('SUPABASE_SERVICE_ROLE_KEY');
  }

  // 3. Admin Authentication
  if (!process.env.ADMIN_PASSWORD_HASH) {
    missingVariables.push('ADMIN_PASSWORD_HASH');
  }
  if (!process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET === 'smartpdf-admin-secret-key-default-salt-32b') {
    warnings.push('ADMIN_SESSION_SECRET is using the fallback default key. Generate a high-entropy secret for production.');
  }

  // 4. Telegram Storage Architecture
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    missingVariables.push('TELEGRAM_BOT_TOKEN');
  }
  if (!process.env.TELEGRAM_WEBHOOK_SECRET) {
    missingVariables.push('TELEGRAM_WEBHOOK_SECRET');
  }
  if (!process.env.TELEGRAM_ALLOWED_CHAT_IDS && !process.env.TELEGRAM_CHANNEL_OR_CHAT_ID) {
    warnings.push('Neither TELEGRAM_ALLOWED_CHAT_IDS nor TELEGRAM_CHANNEL_OR_CHAT_ID is defined. Webhooks from private groups cannot be filtered.');
  }

  return {
    valid: missingVariables.length === 0,
    missingVariables,
    warnings,
  };
}
