import crypto from 'crypto';
import { cookies } from 'next/headers';
import { getAdminClient } from '@/lib/supabase/admin';

export const ADMIN_COOKIE_NAME = 'smartpdf_admin_session';

/**
 * Derives a cryptographically secure password hash using scrypt.
 * Format: scrypt:<salt_hex>:<hash_hex>
 */
export function hashAdminPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verifies a plaintext password against a stored scrypt hash string.
 */
export function verifyAdminPassword(password: string, storedHash?: string): boolean {
  if (!storedHash) return false;

  try {
    const parts = storedHash.split(':');
    if (parts.length === 3 && parts[0] === 'scrypt') {
      const salt = parts[1];
      const originalKey = Buffer.from(parts[2], 'hex');
      const derivedKey = crypto.scryptSync(password, salt, 64);
      if (originalKey.length !== derivedKey.length) {
        return false;
      }
      return crypto.timingSafeEqual(originalKey, derivedKey);
    }

    // Fallback: If ADMIN_PASSWORD_HASH is provided as a plain string in development test mode
    if (process.env.NODE_ENV !== 'production' && password === storedHash) {
      return true;
    }

    return false;
  } catch (err) {
    console.error('Password verification error:', err);
    return false;
  }
}

/**
 * Hashes a session token for safe storage in the database.
 */
export function hashSessionToken(token: string): string {
  const secret = process.env.ADMIN_SESSION_SECRET || 'smartpdf-admin-secret-key-default-salt-32b';
  return crypto.createHmac('sha256', secret).update(token).digest('hex');
}

/**
 * Creates an admin session in PostgreSQL and returns the plain cookie token.
 */
export async function createAdminSession(
  username: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ token: string; expiresAt: Date } | null> {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashSessionToken(token);

  const durationHours = parseInt(process.env.ADMIN_SESSION_DURATION_HOURS || '8', 10);
  const expiresAt = new Date(Date.now() + durationHours * 3600 * 1000);

  const adminClient = getAdminClient();
  if (!adminClient) {
    console.error('Admin client unavailable for session creation');
    return null;
  }

  const { error } = await adminClient.from('admin_sessions').insert({
    token_hash: tokenHash,
    username,
    ip_address: ipAddress || null,
    user_agent: userAgent || null,
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    console.error('Failed to persist admin session in database:', error);
    return null;
  }

  return { token, expiresAt };
}

/**
 * Verifies the validity of an admin session token against the database.
 */
export async function verifyAdminSessionToken(
  token?: string | null
): Promise<{ valid: boolean; username?: string; sessionId?: string }> {
  if (!token) return { valid: false };

  const tokenHash = hashSessionToken(token);
  const adminClient = getAdminClient();
  if (!adminClient) return { valid: false };

  const { data, error } = await adminClient
    .from('admin_sessions')
    .select('id, username, expires_at, revoked_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error || !data) {
    return { valid: false };
  }

  if (data.revoked_at) {
    return { valid: false };
  }

  if (new Date(data.expires_at) < new Date()) {
    return { valid: false };
  }

  return {
    valid: true,
    username: data.username,
    sessionId: data.id,
  };
}

/**
 * Server-side helper to read and verify the admin session from cookies.
 */
export async function getVerifiedAdminSession(): Promise<{
  valid: boolean;
  username?: string;
  sessionId?: string;
}> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
    return await verifyAdminSessionToken(token);
  } catch (err) {
    return { valid: false };
  }
}

/**
 * Revokes the current admin session.
 */
export async function revokeCurrentAdminSession(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
    if (!token) return true;

    const tokenHash = hashSessionToken(token);
    const adminClient = getAdminClient();
    if (adminClient) {
      await adminClient
        .from('admin_sessions')
        .update({ revoked_at: new Date().toISOString() })
        .eq('token_hash', tokenHash);
    }

    return true;
  } catch (err) {
    console.error('Error revoking admin session:', err);
    return false;
  }
}

/**
 * Helper to record actions in the admin_activity_logs table.
 */
export async function logAdminActivity(
  username: string,
  action: string,
  targetType?: string,
  targetId?: string,
  details: Record<string, any> = {}
) {
  try {
    const adminClient = getAdminClient();
    if (!adminClient) return;

    await adminClient.from('admin_activity_logs').insert({
      admin_username: username,
      action,
      target_type: targetType || null,
      target_id: targetId || null,
      details,
    });
  } catch (err) {
    console.error('Failed to log admin activity:', err);
  }
}
