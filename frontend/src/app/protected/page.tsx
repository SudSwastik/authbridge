import { requireSession } from "@/lib/auth/dal";
import { fetchFromBackend } from "@/lib/backendClient";

export default async function ProtectedPage() {
  const session = await requireSession();
  const response = await fetchFromBackend("/api/protected/hello", session);
  const body = await response.json();

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Protected page</h1>
      <p>Signed in as {session.subject}</p>
      <p>Response from the Spring Boot backend (GET /api/protected/hello):</p>
      <pre>{JSON.stringify(body, null, 2)}</pre>
    </main>
  );
}
