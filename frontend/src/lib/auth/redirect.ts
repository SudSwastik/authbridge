import { NextRequest, NextResponse } from "next/server";

/** Only same-origin relative paths are allowed — never redirect off-site after login/refresh. */
export function sanitizeRedirectTarget(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

export function redirectToLogin(request: NextRequest, redirectTo: string): NextResponse {
  const loginUrl = new URL("/api/auth/login", request.url);
  loginUrl.searchParams.set("redirect_to", redirectTo);
  return NextResponse.redirect(loginUrl);
}
