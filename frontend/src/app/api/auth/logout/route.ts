import { NextRequest, NextResponse } from "next/server";
import { oidcAuthProvider } from "@/lib/auth/oidcAuthProvider";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

// Auth0 free-tier *custom social* OIDC connections (unlike paid Enterprise connections)
// have no first-class federated logout, so chaining on to Entra's own end_session_endpoint
// is best-effort — see docs/SETUP.md and docs/E2E_TEST_PLAN.md. Set UPSTREAM_END_SESSION_URL
// to attempt the chain; leave it unset to just end the Auth0/app session (the user may still
// carry an SSO session at Entra and get silently re-authenticated on the next login).
export async function GET(request: NextRequest) {
  const upstreamEndSessionUrl = process.env.UPSTREAM_END_SESSION_URL;
  const appBaseUrl = process.env.APP_BASE_URL ?? request.nextUrl.origin;

  const postLogoutRedirectUri = upstreamEndSessionUrl
    ? `${appBaseUrl}/api/auth/logout/upstream`
    : (process.env.OIDC_POST_LOGOUT_REDIRECT_URI ?? appBaseUrl);

  const providerLogoutUrl = await oidcAuthProvider.buildLogoutUrl(postLogoutRedirectUri);

  const response = NextResponse.redirect(providerLogoutUrl);
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
