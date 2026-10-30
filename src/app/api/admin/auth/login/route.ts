import { NextResponse } from 'next/server';
import {
  verifyAdminPassword,
  createAdminSession,
  logAdminActivity,
  ADMIN_COOKIE_NAME,
} from '@/lib/auth/adminAuth';
import { checkRateLimit } from '@/lib/api/rateLimit';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function POST(request: Request) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1';
  const userAgent = request.headers.get('user-agent') || 'Unknown';

  // Rate limiting: 5 login attempts per 15 minutes per IP
  const rateLimit = checkRateLimit(`admin-login:${ip}`, 5, 15 * 60 * 1000);
  if (!rateLimit.success) {
    return apiError(
      'RATE_LIMIT_EXCEEDED',
      'Too many failed login attempts. Please try again later.',
      429
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return apiError('INVALID_REQUEST', 'Invalid JSON payload', 400);
  }

  const { username, password } = body || {};

  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    return apiError('INVALID_CREDENTIALS', 'Username and password are required', 400);
  }

  const configuredUsername = process.env.ADMIN_USERNAME || 'admin';
  const configuredPasswordHash = process.env.ADMIN_PASSWORD_HASH;

  // Verify username match (case-insensitive for safety or exact)
  const isUsernameMatch = username.trim().toLowerCase() === configuredUsername.toLowerCase();

  // Verify password hash
  const isPasswordMatch = isUsernameMatch && verifyAdminPassword(password, configuredPasswordHash);

  if (!isUsernameMatch || !isPasswordMatch) {
    // Audit failed attempt (non-sensitive details)
    await logAdminActivity('system', 'admin_login_failed', 'auth', undefined, {
      attempted_username: username,
      ip,
    });

    return apiError('INVALID_CREDENTIALS', 'Invalid administrator username or password', 401);
  }

  // Create database-persisted session
  const session = await createAdminSession(configuredUsername, ip, userAgent);
  if (!session) {
    return apiError('INTERNAL_ERROR', 'Failed to initialize administrative session', 500);
  }

  // Log successful login
  await logAdminActivity(configuredUsername, 'admin_login', 'session', session.token.slice(0, 8), {
    ip,
    user_agent: userAgent,
  });

  const response = apiSuccess({
    authenticated: true,
    username: configuredUsername,
    expiresAt: session.expiresAt.toISOString(),
  });

  const isProduction = process.env.NODE_ENV === 'production';
  const maxAgeSeconds = parseInt(process.env.ADMIN_SESSION_DURATION_HOURS || '8', 10) * 3600;

  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: session.token,
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSeconds,
  });

  return response;
}
