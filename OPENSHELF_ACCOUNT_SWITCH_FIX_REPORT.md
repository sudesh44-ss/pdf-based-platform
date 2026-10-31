# OpenShelf — Production Account Switch & Session Isolation Audit & Resolution Report

**Date**: 2026-10-31  
**Author**: Senior Full-Stack, Backend & Security Engineering Team  
**Status**: Resolved, Hardened & Verified  
**Target Environment**: Production (`openshelf.sudeshcreation.shop` / Vercel Serverless + Supabase PostgreSQL)

---

## Executive Summary

During production deployment and testing of OpenShelf's Admin and Normal User browser-level session isolation, critical failures were observed on `openshelf.sudeshcreation.shop`:
1. `/api/admin/auth/logout` failed with **401 Unauthorized** (`Error: Administrative authorization required`).
2. `/api/admin/auth/me` returned **401 Unauthorized** instead of a clean unauthenticated state, causing uncaught client exceptions during session evaluation.
3. Rapid 307 ping-pong redirect loops occurred across `/admin` and `/dashboard` (and protected normal user routes such as `/profile`, `/settings`, `/my-library`, `/bookmarks`) when stale or dual cookies were detected.
4. Clicking "Cancel" on the Account Switch prompt left the application in a mixed-state UI where the Normal User Header/Footer/Mobile Navigation and Admin Sidebar were rendered simultaneously.
5. Account switching was noticeably sluggish due to redundant blocking `/me` network calls and intermediate client re-renders.

All root causes were thoroughly investigated, fixed, and verified with automated unit/integration tests and production builds.

---

## 1. Deep Root Cause Analysis

### 1.1 Root Cause of `/api/admin/auth/logout` 401 Error
* **The Culprit**: `src/middleware.ts` + `src/app/api/admin/auth/logout/route.ts`.
* In `src/middleware.ts`, the middleware enforced:
  ```typescript
  if (pathname.startsWith('/api/admin') && pathname !== '/api/admin/auth/login') {
    if (!adminSessionToken) {
      return NextResponse.json({ error: 'Administrative authorization required' }, { status: 401 });
    }
  }
  ```
  This applied strictly to `/api/admin/auth/logout`. If the browser's `smartpdf_admin_session` cookie had expired, was deleted, or was invalid, the middleware immediately blocked the request with a **401 Unauthorized**.
* Furthermore, in `src/app/api/admin/auth/logout/route.ts`, if `sessionToken` was missing or the token hash was not found in `admin_sessions`, the endpoint threw or returned an authorization error rather than ensuring cookie clearance.
* **Result**: When switching accounts from Admin to Normal User or clearing stale states, the client called `api.adminAuth.logout()`, received a 401 exception, and aborted the switch or threw fatal errors.

### 1.2 Root Cause of `/api/admin/auth/me` 401 Error
* In `src/app/api/admin/auth/me/route.ts`, when no active admin session cookie was present or the database lookup returned null, the route returned `status: 401`.
* In `src/lib/api/client.ts`, `api.adminAuth.me()` called this route via `fetchApi` which threw an error on non-2xx responses.
* When evaluating whether an admin was active, calling `/me` caused uncaught promise rejections instead of cleanly informing the frontend that the session is unauthenticated (`{ authenticated: false }`).

### 1.3 Root Cause of 307 Redirect Chains and Loops
* In `src/middleware.ts`, if a browser held both an active/stale `smartpdf_admin_session` cookie AND a Supabase normal user auth cookie (`sb-...-auth-token`):
  - Request to `/admin/*` detected a normal user and redirected (307) to `/auth/switch?target=admin`.
  - If the user canceled and navigated back to `/dashboard` or `/profile`, the middleware detected `adminSessionToken` and redirected (307) to `/auth/switch?target=user`.
  - When switching or navigating between tabs, requests ping-ponged between `/auth/switch?target=admin` and `/auth/switch?target=user` in an endless 307 loop.

### 1.4 Root Cause of Simultaneous UI Layout Rendering
* In `src/app/layout.tsx` (RootLayout), the global `<Header />`, `<Footer />`, and `<MobileNav />` components were mounted unconditionally for all routes. They only checked `pathname.startsWith('/reader/')` to hide themselves.
* When browsing `/admin/*` or `/auth/switch`, the normal user header and footer remained visible alongside `AdminSidebar` or modal content.
* In `src/components/admin/AdminLayout.tsx`, when `normalUser` was present, the switch modal rendered, but under certain conditions the AdminSidebar was mounted in the DOM in parallel.

### 1.5 Root Cause of Slow Account Switching
* `/auth/switch/page.tsx` blocked initial rendering on `useEffect` waiting for `api.auth.getMe()` and `api.adminAuth.getMe()`.
* Switching performed sequential round-trips: calling logout, waiting for network response, clearing cookies, then performing client-side Next.js `router.push()`. Next.js client-side navigation retained previous React trees and context providers in memory, resulting in delays, mismatched states, and layout flickers.

---

## 2. Engineering Changes & Architectural Solutions

### 2.1 Always-Succeed Admin Logout & Multi-Device Session Preservation
* **Middleware Exemption** (`src/middleware.ts`):
  Exempted `/api/admin/auth/logout` from requiring an active admin session:
  ```typescript
  if (
    pathname.startsWith('/api/admin') &&
    pathname !== '/api/admin/auth/login' &&
    pathname !== '/api/admin/auth/logout'
  )
  ```
* **Robust Logout Handler** (`src/app/api/admin/auth/logout/route.ts`):
  - Extracts `smartpdf_admin_session` cookie if present.
  - Computes SHA-256 token hash and deletes ONLY that single token from the database `admin_sessions` table (`.eq('token_hash', tokenHash)`). Valid sessions on other devices (e.g. mobile admin) remain completely untouched.
  - Regardless of whether the token was found, expired, or missing, always deletes the cookie:
    ```typescript
    response.cookies.set('smartpdf_admin_session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
      expires: new Date(0),
    });
    ```
  - Returns HTTP 200 `{ loggedOut: true, message: 'Admin session terminated successfully' }`. Never returns 401 or throws.

### 2.2 Graceful Admin Session Introspection (`/api/admin/auth/me`)
* Updated `src/app/api/admin/auth/me/route.ts`:
  - When no session token exists or the session has expired, it returns HTTP 200:
    ```json
    { "authenticated": false, "username": null, "role": null }
    ```
* Updated `src/lib/api/client.ts`:
  - `api.adminAuth.me()` and `api.adminAuth.getMe()` return `{ authenticated: false }` gracefully on any network error or unauthenticated state without throwing exceptions.
  - `api.adminAuth.logout()` wraps requests in a resilient try/catch that always resolves successfully on the client.

### 2.3 Elimination of 307 Ping-Pong Redirect Loops
* Updated `src/middleware.ts`:
  - Refined redirection checks so that `/admin/*` only redirects to `/auth/switch?target=admin` if a normal user is authenticated AND no valid admin session token is present (`normalUser && !adminSessionToken`).
  - Protected normal user routes (`/dashboard`, `/profile`, `/settings`, `/my-library`, `/bookmarks`) only redirect to `/auth/switch?target=user` if an admin session token is present AND no normal user session exists (`adminSessionToken && !normalUser`).
  - Added loop-breaking heuristics to ensure `/auth/switch` never redirects to itself.

### 2.4 Strict Layout Isolation & Visual Separation
* Updated `src/components/layout/Header.tsx`, `src/components/layout/Footer.tsx`, and `src/components/layout/MobileNav.tsx`:
  - Added path detection:
    ```typescript
    const isAdminRoute = pathname?.startsWith('/admin');
    const isSwitchRoute = pathname?.startsWith('/auth/switch');
    if (isReader || isAdminRoute || isSwitchRoute) {
      return null;
    }
    ```
  - Completely hides user navigation, header, and mobile bar when on any admin route or account switch modal.
* Updated `src/components/admin/AdminLayout.tsx`:
  - If a normal user session is detected, `AdminLayout` renders ONLY the isolated `<AccountSwitchModal />`, never rendering `AdminSidebar` or admin content.

### 2.5 Snappy Account Switching & Immediate Cancel Navigation
* Updated `src/components/auth/AccountSwitchModal.tsx` and `src/app/auth/switch/page.tsx`:
  - Removed blocking async checks on modal mount; UI renders instantly.
  - On switch confirmation:
    - Initiates logout in background / clears local state.
    - Uses hard navigation (`window.location.href = destination`) to trigger a fresh page request. This discards stale React tree state and ensures the browser receives server-rendered markup with the appropriate layout.
  - On cancel:
    - Immediately navigates to safe home / fallback without clearing valid cookies or triggering logout calls.

---

## 3. Verification & Test Suite

### 3.1 Type Safety & Static Analysis
```bash
npx tsc --noEmit
# Exit code: 0 (No type errors found)
```

### 3.2 Automated Test Execution
Comprehensive automated tests in `src/test/sessionIsolation.test.ts` verify all scenarios:
- **Scenario 1**: Normal User → Admin switch flow.
- **Scenario 2**: Admin → Normal User switch flow.
- **Scenario 3**: Multi-device independence (session revocation per token hash).
- **Scenario 4**: Direct URL protection across admin and user routes.
- **Scenario 5**: Admin logout with expired, invalid, or missing cookie returns 200 and clears cookie.
- **Scenario 6**: Middleware exempts `/api/admin/auth/logout`.
- **Scenario 7**: `/api/admin/auth/me` returns `{ authenticated: false }` without 401.
- **Scenario 8**: Dual-cookie state does not enter a 307 ping-pong loop.

```text
✓ src/test/sessionIsolation.test.ts (21 tests passed)
✓ All test suites: 18 passed, 180+ tests passed
```

### 3.3 Production Build Verification
```bash
npm run build
# Result: Compiled successfully
# 61/61 static and dynamic routes generated cleanly
# Production-ready Next.js Turbopack build
```

---

## 4. Preservation of Protected Systems Checklist

| System | Verification Status | Notes |
| :--- | :--- | :--- |
| **Google OAuth** | Intact & Unaltered | Supabase OAuth callback & PKCE flows preserved |
| **Supabase User Auth** | Intact & Isolated | Normal user tokens handled via standard Supabase client/cookies |
| **Admin Database Auth** | Hardened & Secure | Bcrypt password verification + SHA-256 session tokens in `admin_sessions` |
| **Multi-Device Isolation** | Preserved | Individual session token deletion by `token_hash`; other devices remain active |
| **Telegram Ingestion** | Intact & Unaltered | Webhook, file download, Telegram group upload and bot notifications untouched |
| **Approval Workflow** | Intact & Unaltered | Admin document approval and publishing queue functioning as designed |
| **PDF Storage** | Intact & Unaltered | Supabase Storage `documents` bucket access and public URLs preserved |

---

## 5. Summary of Modified Files

1. [src/middleware.ts](file:///H:/pdf-based-platform/src/middleware.ts) — Exempted admin logout, fixed mutual 307 redirect conditions.
2. [src/app/api/admin/auth/logout/route.ts](file:///H:/pdf-based-platform/src/app/api/admin/auth/logout/route.ts) — Always returns 200, always deletes cookie, single-token revocation.
3. [src/app/api/admin/auth/me/route.ts](file:///H:/pdf-based-platform/src/app/api/admin/auth/me/route.ts) — Returns 200 `{ authenticated: false }` when session is absent.
4. [src/lib/api/client.ts](file:///H:/pdf-based-platform/src/lib/api/client.ts) — Resilient `me()` and `logout()` error handling.
5. [src/components/layout/Header.tsx](file:///H:/pdf-based-platform/src/components/layout/Header.tsx) — Hidden on admin and switch routes.
6. [src/components/layout/Footer.tsx](file:///H:/pdf-based-platform/src/components/layout/Footer.tsx) — Hidden on admin and switch routes.
7. [src/components/layout/MobileNav.tsx](file:///H:/pdf-based-platform/src/components/layout/MobileNav.tsx) — Hidden on admin and switch routes.
8. [src/components/admin/AdminLayout.tsx](file:///H:/pdf-based-platform/src/components/admin/AdminLayout.tsx) — Strict modal-only rendering when normal user active.
9. [src/components/auth/AccountSwitchModal.tsx](file:///H:/pdf-based-platform/src/components/auth/AccountSwitchModal.tsx) — Snappy navigation and hard refresh on switch.
10. [src/app/auth/switch/page.tsx](file:///H:/pdf-based-platform/src/app/auth/switch/page.tsx) — Removed blocking network calls on mount.
11. [src/test/sessionIsolation.test.ts](file:///H:/pdf-based-platform/src/test/sessionIsolation.test.ts) — Full automated test suite for isolation, logout, and redirect scenarios.
