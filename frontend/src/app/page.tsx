import Link from "next/link";
import { cookies } from "next/headers";
import { decryptSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ login_error?: string }>;
}) {
  const { login_error: loginError } = await searchParams;
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = sessionCookie ? await decryptSession(sessionCookie) : null;

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>AuthBridge</h1>
      <p>Vendor-neutral OIDC reference: Next.js frontend, Spring Boot resource server.</p>

      {loginError && <p style={{ color: "crimson" }}>Login failed: {loginError}</p>}

      {session ? (
        <>
          <p>Signed in as {session.subject}</p>
          <p>
            <Link href="/protected">Protected page</Link>
            {" · "}
            <Link href="/protected/admin">Admin page</Link>
            {" · "}
            <a href="/api/auth/logout">Log out</a>
          </p>
        </>
      ) : (
        <p>
          <a href="/api/auth/login">Log in</a>
        </p>
      )}
    </main>
  );
}
