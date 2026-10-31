import { getVerifiedAdminSession } from '@/lib/auth/adminAuth';
import { apiSuccess } from '@/lib/api/response';

/**
 * Admin Session Verification API Route
 *
 * Requirements:
 * - When a valid Admin session exists: returns { authenticated: true, username, role: 'admin' }.
 * - When no valid Admin session exists (or session is expired/revoked): returns { authenticated: false, username: null, role: null }
 *   as a clean authentication state instead of throwing an error or application crash.
 * - Protected administrative data endpoints (/api/admin/documents, etc.) continue to strictly enforce HTTP 401.
 */
export async function GET(_request: Request) {
  try {
    const session = await getVerifiedAdminSession();
    if (!session.valid || !session.username) {
      return apiSuccess({
        authenticated: false,
        username: null,
        role: null,
      });
    }

    return apiSuccess({
      authenticated: true,
      username: session.username,
      role: 'admin',
    });
  } catch (err) {
    return apiSuccess({
      authenticated: false,
      username: null,
      role: null,
    });
  }
}
