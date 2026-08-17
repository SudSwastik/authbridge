import { NextRequest, NextResponse } from "next/server";
import { oidcAuthProvider } from "@/lib/auth/oidcAuthProvider";
import {
  decryptPkceTransaction,
  encryptSession,
  PKCE_COOKIE_NAME,
  SESSION_COOKIE_MAX_AGE_SECONDS,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  // Cancelled login at Entra, or any other upstream error, comes back as `?error=` rather
  // than `code` — surface it without ever creating a session.
  const providerError = request.nextUrl.searchParams.get("error");
  if (providerError) {
    return NextResponse.redirect(
      new URL(`/?login_error=${encodeURIComponent(providerError)}`, request.url),
    );
  }

  const pkceCookie = request.cookies.get(PKCE_COOKIE_NAME)?.value;
  if (!pkceCookie) {
    return NextResponse.redirect(new URL("/?login_error=missing_transaction", request.url));
  }

  const pkce = await decryptPkceTransaction(pkceCookie);
  if (!pkce) {
    return NextResponse.redirect(new URL("/?login_error=expired_transaction", request.url));
  }

  let session;
  try {
    session = await oidcAuthProvider.handleCallback(new URL(request.url), pkce);
  } catch {
    // Tampered state/nonce, a replayed code, or a rejected token exchange all land here —
    // never partially create a session.
    return NextResponse.redirect(new URL("/?login_error=callback_failed", request.url));
  }

  const response = NextResponse.redirect(new URL(pkce.redirectTo, request.url));
  const sessionCookie = await encryptSession(session);
  response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  });
  response.cookies.delete(PKCE_COOKIE_NAME);

  return response;
}
