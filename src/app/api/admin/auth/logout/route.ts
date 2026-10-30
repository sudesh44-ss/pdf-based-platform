import { NextResponse } from 'next/server';
import {
  revokeCurrentAdminSession,
  getVerifiedAdminSession,
  logAdminActivity,
  ADMIN_COOKIE_NAME,
} from '@/lib/auth/adminAuth';
import { apiSuccess } from '@/lib/api/response';

export async function POST(_request: Request) {
  const session = await getVerifiedAdminSession();
  if (session.valid && session.username) {
    await logAdminActivity(session.username, 'admin_logout', 'session', session.sessionId);
  }

  await revokeCurrentAdminSession();

  const response = apiSuccess({ loggedOut: true });
  response.cookies.delete(ADMIN_COOKIE_NAME);
  return response;
}
