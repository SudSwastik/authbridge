import { NextRequest, NextResponse } from "next/server";
import { oidcAuthProvider } from "@/lib/auth/oidcAuthProvider";
import {
  encryptPkceTransaction,
  PKCE_COOKIE_MAX_AGE_SECONDS,
  PKCE_COOKIE_NAME,
} from "@/lib/auth/session";
import { sanitizeRedirectTarget } from "@/lib/auth/redirect";

export async function GET(request: NextRequest) {
  const redirectTo = sanitizeRedirectTarget(request.nextUrl.searchParams.get("redirect_to"));
  const { authorizationUrl, pkce } = await oidcAuthProvider.startLogin();

  const response = NextResponse.redirect(authorizationUrl);
  const pkceCookie = await encryptPkceTransaction({ ...pkce, redirectTo });
  response.cookies.set(PKCE_COOKIE_NAME, pkceCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PKCE_COOKIE_MAX_AGE_SECONDS,
  });

  return response;
}
