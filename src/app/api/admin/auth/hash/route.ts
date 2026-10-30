import { getVerifiedAdminSession, hashAdminPassword } from '@/lib/auth/adminAuth';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function POST(request: Request) {
  const session = await getVerifiedAdminSession();
  if (!session.valid) {
    return apiError('UNAUTHORIZED', 'Administrator session required', 401);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return apiError('INVALID_REQUEST', 'Invalid JSON body', 400);
  }

  const { password } = body || {};
  if (!password || typeof password !== 'string') {
    return apiError('VALIDATION_ERROR', 'Password string is required', 400);
  }

  const hash = hashAdminPassword(password);
  return apiSuccess({ hash });
}
