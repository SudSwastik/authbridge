import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { decryptSession, SESSION_COOKIE_NAME } from "./session";
import type { AuthSession } from "./AuthProvider";

/**
 * The real authorization check for Server Components. proxy.ts only does a fast,
 * cookie-presence-and-expiry check to redirect unauthenticated users early (an "optimistic"
 * check, per Next.js's own guidance) — it is explicitly not meant to be the sole line of
 * defense. Every protected page calls this directly instead of trusting that proxy already
 * ran.
 */
export async function requireSession(): Promise<AuthSession> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = cookie ? await decryptSession(cookie) : null;

  if (!session) {
    redirect("/api/auth/login");
  }

  return session;
}
