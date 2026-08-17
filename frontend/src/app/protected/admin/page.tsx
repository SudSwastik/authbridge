import { requireSession } from "@/lib/auth/dal";
import { fetchFromBackend } from "@/lib/backendClient";

export default async function AdminPage() {
  const session = await requireSession();
  const response = await fetchFromBackend("/api/protected/admin/ping", session);

  if (response.status === 403) {
    return (
      <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <h1>Admin page</h1>
        <p>
          Signed in as {session.subject}, but not mapped to the ADMIN role
          (app.authorization.role-mapping on the backend). This is the &quot;missing group
          claim&quot; case from docs/E2E_TEST_PLAN.md — a 403, not a 500.
        </p>
      </main>
    );
  }

  const body = await response.json();
  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Admin page</h1>
      <p>Response from the Spring Boot backend (GET /api/protected/admin/ping):</p>
      <pre>{JSON.stringify(body, null, 2)}</pre>
    </main>
  );
}
