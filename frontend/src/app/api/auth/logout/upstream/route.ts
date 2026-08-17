import { NextRequest, NextResponse } from "next/server";

// Only reached when UPSTREAM_END_SESSION_URL is configured and Auth0's own logout redirects
// here — see the comment in ../route.ts. Chains on to Entra's RP-Initiated Logout endpoint
// so the upstream corporate session ends too, best-effort.
export async function GET(request: NextRequest) {
  const upstreamEndSessionUrl = process.env.UPSTREAM_END_SESSION_URL;
  const finalRedirect = process.env.OIDC_POST_LOGOUT_REDIRECT_URI ?? request.nextUrl.origin;

  if (!upstreamEndSessionUrl) {
    // Reached without the chain configured — land safely on the app instead of erroring.
    return NextResponse.redirect(finalRedirect);
  }

  const url = new URL(upstreamEndSessionUrl);
  url.searchParams.set("post_logout_redirect_uri", finalRedirect);
  return NextResponse.redirect(url);
}
