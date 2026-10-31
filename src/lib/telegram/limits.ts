/**
 * Official Telegram Bot API File Limits and Documentation
 *
 * Official Cloud Bot API (https://api.telegram.org):
 * - Maximum outgoing document upload (sendDocument): 50 MB (52,428,800 bytes).
 * - Maximum file size downloadable via getFile endpoint: 20 MB (20,971,520 bytes).
 *
 * Self-Hosted Local Telegram Bot API Server (https://core.telegram.org/bots/api#using-a-local-bot-api-server):
 * - When run with `--local` flag:
 *   - Maximum upload: 2,000 MB (2 GB).
 *   - Maximum download: 2,000 MB (2 GB).
 *   - Zero rate limits, direct local filesystem I/O without network transfer overhead.
 *
 * Application Upload Policy:
 * - Application limit is 100 MB (104,857,600 bytes).
 * - Files <= 50 MB work transparently with the cloud Telegram Bot API.
 * - Files between 50 MB and 100 MB require a self-hosted Telegram Bot API server or secondary R2 storage adapter.
 */

export const TELEGRAM_LIMITS = {
  CLOUD_BOT_API_UPLOAD_MAX_BYTES: 50 * 1024 * 1024, // 50 MB
  CLOUD_BOT_API_DOWNLOAD_MAX_BYTES: 20 * 1024 * 1024, // 20 MB
  LOCAL_BOT_API_MAX_BYTES: 2000 * 1024 * 1024, // 2000 MB (2 GB)
  APP_MAX_UPLOAD_BYTES: 100 * 1024 * 1024, // 100 MB
};

/**
 * Direct Admin Panel -> Vercel Serverless Function Limits
 * Vercel Serverless Functions enforce a 4.5 MB request body limit.
 * We enforce a safe 4.0 MB limit for the raw PDF binary to account for multipart/form-data overhead.
 */
export const ADMIN_DIRECT_UPLOAD_LIMITS = {
  MAX_FILE_BYTES: 4 * 1024 * 1024, // 4 MB safe binary limit
  MAX_REQUEST_BYTES: 4.5 * 1024 * 1024, // 4.5 MB Vercel function payload ceiling
};

export function checkTelegramUploadEligibility(fileSizeBytes: number, isLocalApiServer: boolean): {
  eligible: boolean;
  reason?: string;
} {
  if (isLocalApiServer) {
    if (fileSizeBytes > TELEGRAM_LIMITS.LOCAL_BOT_API_MAX_BYTES) {
      return {
        eligible: false,
        reason: `File size ${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB exceeds the 2,000 MB limit of local Telegram Bot API servers.`,
      };
    }
    return { eligible: true };
  }

  if (fileSizeBytes > TELEGRAM_LIMITS.CLOUD_BOT_API_UPLOAD_MAX_BYTES) {
    return {
      eligible: false,
      reason: `File size ${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB exceeds the 50 MB limit of the official Telegram Cloud Bot API. To upload up to 100 MB via Telegram, configure TELEGRAM_API_BASE_URL to point to a self-hosted local Bot API server.`,
    };
  }

  return { eligible: true };
}
