import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/my-library',
  '/notes',
  '/notebooks',
  '/bookmarks',
  '/highlights',
  '/storage',
  '/statistics',
  '/settings',
  '/profile',
  '/my-contributions',
];

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function sanitizeRedirect(nextParam: string | null): string {
  if (!nextParam) return '/dashboard';
  // Open redirect defense: must begin with a single slash, not double slash or backslash
  if (
    nextParam.startsWith('/') &&
    !nextParam.startsWith('//') &&
    !nextParam.startsWith('/\\') &&
    !nextParam.includes(':')
  ) {
    return nextParam;
  }
  return '/dashboard';
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const pathname = request.nextUrl.pathname;

  // Static assets bypass
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|pdf|webp)$/)
  ) {
    return supabaseResponse;
  }

  // =========================================================================
  // 1. DEDICATED SEPARATE ADMIN AUTHENTICATION GATE
  // =========================================================================
  if (pathname.startsWith('/admin')) {
    const adminSessionToken = request.cookies.get('smartpdf_admin_session')?.value;

    if (pathname === '/admin/login') {
      if (adminSessionToken) {
        return NextResponse.redirect(new URL('/admin', request.url));
      }
      return supabaseResponse;
    }

    // All other /admin/* routes require a valid admin session cookie
    if (!adminSessionToken) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }

    return supabaseResponse;
  }

  // Protect Admin APIs at middleware boundary
  if (pathname.startsWith('/api/admin') && pathname !== '/api/admin/auth/login') {
    const adminSessionToken = request.cookies.get('smartpdf_admin_session')?.value;
    if (!adminSessionToken) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Administrative authorization required',
          },
        },
        { status: 401 }
      );
    }

    // CSRF protection for mutating admin requests
    const method = request.method.toUpperCase();
    if (['POST', 'PATCH', 'DELETE', 'PUT'].includes(method)) {
      const origin = request.headers.get('origin');
      const host = request.headers.get('host');
      if (origin && host) {
        try {
          const originUrl = new URL(origin);
          if (originUrl.host !== host) {
            return NextResponse.json(
              {
                success: false,
                error: {
                  code: 'CSRF_BLOCKED',
                  message: 'Cross-origin request rejected',
                },
              },
              { status: 403 }
            );
          }
        } catch {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'CSRF_BLOCKED',
                message: 'Invalid request origin',
              },
            },
            { status: 403 }
          );
        }
      }
    }

    return supabaseResponse;
  }

  // =========================================================================
  // 2. NORMAL GOOGLE USER SUPABASE AUTHENTICATION
  // =========================================================================
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    if (isProtectedPath(pathname)) {
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('error', 'unconfigured');
      return NextResponse.redirect(loginUrl);
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Verify and refresh normal user session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Enforce authentication on protected user routes
  if (isProtectedPath(pathname) && !user) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated user away from user login page
  if (pathname === '/auth/login' && user) {
    const nextParam = request.nextUrl.searchParams.get('next');
    const safeDestination = sanitizeRedirect(nextParam);
    return NextResponse.redirect(new URL(safeDestination, request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|pdf)$).*)',
  ],
};
