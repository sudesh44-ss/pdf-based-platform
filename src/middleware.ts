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

  // Account Switch experience bypass: allow rendering of the account-switch prompt
  if (pathname === '/auth/switch') {
    return supabaseResponse;
  }

  // =========================================================================
  // 1. SESSION DETECTION (Server-side inspection of both account states)
  // =========================================================================
  const adminSessionToken = request.cookies.get('smartpdf_admin_session')?.value;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let normalUser: any = null;
  if (supabaseUrl && supabaseAnonKey) {
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

    try {
      const { data } = await supabase.auth.getUser();
      normalUser = data?.user || null;
    } catch {
      normalUser = null;
    }
  }

  // =========================================================================
  // 2. DIRECT ADMIN URL & API PROTECTION (Normal User -> Admin Isolation)
  // =========================================================================

  // Handle Admin APIs
  if (pathname.startsWith('/api/admin')) {
    // If a Normal User attempts to authenticate via Admin Login API, block with 409 Conflict
    if (pathname === '/api/admin/auth/login' && normalUser) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SESSION_CONFLICT',
            message:
              'A Normal User account is currently logged in on this browser. To access the Admin Panel, you must switch accounts.',
          },
        },
        { status: 409 }
      );
    }

    if (pathname !== '/api/admin/auth/login') {
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
    }

    return supabaseResponse;
  }

  // Handle Direct Admin Page Routes (/admin, /admin/login, /admin/*)
  if (pathname.startsWith('/admin')) {
    // A Normal User must NOT be able to access the Admin Panel or Admin Login directly.
    // Trigger the Account-Switch experience immediately.
    if (normalUser) {
      const switchUrl = new URL('/auth/switch', request.url);
      switchUrl.searchParams.set('target', 'admin');
      switchUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(switchUrl);
    }

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

  // =========================================================================
  // 3. DIRECT NORMAL USER ROUTE PROTECTION (Admin -> Normal User Isolation)
  // =========================================================================

  // If an Admin account is active on this browser and attempts to access protected
  // Normal User features or the Normal User login page, trigger the Account-Switch experience.
  if (adminSessionToken) {
    if (isProtectedPath(pathname) || pathname === '/auth/login') {
      const switchUrl = new URL('/auth/switch', request.url);
      switchUrl.searchParams.set('target', 'user');
      switchUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(switchUrl);
    }
    return supabaseResponse;
  }

  // =========================================================================
  // 4. STANDARD NORMAL USER SUPABASE AUTHENTICATION
  // =========================================================================
  if (!supabaseUrl || !supabaseAnonKey) {
    if (isProtectedPath(pathname)) {
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('error', 'unconfigured');
      return NextResponse.redirect(loginUrl);
    }
    return supabaseResponse;
  }

  // Enforce authentication on protected user routes
  if (isProtectedPath(pathname) && !normalUser) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated user away from user login page
  if (pathname === '/auth/login' && normalUser) {
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
