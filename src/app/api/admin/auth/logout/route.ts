import {
  revokeCurrentAdminSession,
  getVerifiedAdminSession,
  logAdminActivity,
  ADMIN_COOKIE_NAME,
} from '@/lib/auth/adminAuth';
import { apiSuccess } from '@/lib/api/response';

/**
 * Admin Logout API Route
 *
 * Requirements:
 * - Always clears the current browser's Admin session cookie, even if the session
 *   is already expired, invalid, or missing in PostgreSQL.
 * - If a valid session exists in DB, revokes only that specific device's session token.
 * - Does NOT revoke other devices' Admin sessions.
 * - Always returns HTTP 200 with { loggedOut: true } so the browser can cleanly complete logout.
 * - Never returns 401 Unauthorized for a logout request.
 */
export async function POST(_request: Request) {
  try {
    const session = await getVerifiedAdminSession();
    if (session.valid && session.username) {
      await logAdminActivity(session.username, 'admin_logout', 'session', session.sessionId);
    }
  } catch (err) {
    console.warn('Admin logout audit log notice:', err);
  }

  try {
    await revokeCurrentAdminSession();
  } catch (err) {
    console.warn('Admin logout token revocation notice:', err);
  }

  const response = apiSuccess({ loggedOut: true }, 'Admin logged out successfully');

  // Multi-tier cookie deletion to guarantee removal in all browsers
  response.cookies.delete(ADMIN_COOKIE_NAME);
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: '',
    path: '/',
    maxAge: 0,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  return response;
}
