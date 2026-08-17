import { NextRequest, NextResponse } from "next/server";
import { decryptSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { redirectToLogin, sanitizeRedirectTarget } from "@/lib/auth/redirect";

/**
 * Optimistic route protection (Next.js 16 renamed `middleware.ts` to `proxy.ts` — same
 * mechanism). Proxy defaults to the Node.js runtime here, but per Next's own guidance it's
 * not meant for slow data fetching, so this stays limited to decrypting the cookie and
 * checking its expiry — no OIDC discovery or token-endpoint calls. The actual token refresh
 * happens in the /api/auth/refresh Route Handler this redirects to.
 *
 * This is deliberately not the only line of defense: every protected Server Component also
 * calls requireSession() (lib/auth/dal.ts) itself, since Proxy can be bypassed by Server
 * Functions on unmatched routes and isn't guaranteed to run before every render.
 */

const PROTECTED_PREFIX = "/protected";
// If the access token expires within this window, treat the session as due for a
// server-side refresh rather than waiting for it to fail against the backend.
const REFRESH_THRESHOLD_SECONDS = 60;

export async function proxy(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith(PROTECTED_PREFIX)) {
    return NextResponse.next();
  }

  const redirectTo = sanitizeRedirectTarget(request.nextUrl.pathname + request.nextUrl.search);
  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!cookie) {
    return redirectToLogin(request, redirectTo);
  }

  const session = await decryptSession(cookie);
  if (!session) {
    return redirectToLogin(request, redirectTo);
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (session.accessTokenExpiresAt - nowSeconds <= REFRESH_THRESHOLD_SECONDS) {
    const refreshUrl = new URL("/api/auth/refresh", request.url);
    refreshUrl.searchParams.set("redirect_to", redirectTo);
    return NextResponse.redirect(refreshUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/protected/:path*"],
};
