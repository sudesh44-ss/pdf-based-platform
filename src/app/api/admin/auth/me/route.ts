import { getVerifiedAdminSession } from '@/lib/auth/adminAuth';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function GET(_request: Request) {
  const session = await getVerifiedAdminSession();
  if (!session.valid || !session.username) {
    return apiError('UNAUTHORIZED', 'Valid administrator session required', 401);
  }

  return apiSuccess({
    authenticated: true,
    username: session.username,
    role: 'admin',
  });
}
