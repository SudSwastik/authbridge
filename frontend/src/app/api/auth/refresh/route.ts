import { NextRequest, NextResponse } from "next/server";
import { oidcAuthProvider } from "@/lib/auth/oidcAuthProvider";
import {
  decryptSession,
  encryptSession,
  SESSION_COOKIE_MAX_AGE_SECONDS,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session";
import { redirectToLogin, sanitizeRedirectTarget } from "@/lib/auth/redirect";

// The server-side "silent refresh": proxy.ts redirects here when a protected request's
// access token is near expiry, this does the actual refresh_token grant, and then bounces
// the browser back to where it was headed — no client-side iframe or polling involved.
export async function GET(request: NextRequest) {
  const redirectTo = sanitizeRedirectTarget(request.nextUrl.searchParams.get("redirect_to"));
  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = cookie ? await decryptSession(cookie) : null;

  if (!session?.refreshToken) {
    return redirectToLogin(request, redirectTo);
  }

  let refreshed;
  try {
    refreshed = await oidcAuthProvider.refresh(session);
  } catch {
    // Refresh token expired, revoked, or reused after rotation — the session is dead;
    // fall back to a full login rather than surfacing a 500 to the user.
    return redirectToLogin(request, redirectTo);
  }

  const response = NextResponse.redirect(new URL(redirectTo, request.url));
  const sessionCookie = await encryptSession(refreshed);
  response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  });

  return response;
}
