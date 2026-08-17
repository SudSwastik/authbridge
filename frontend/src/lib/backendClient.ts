import type { AuthSession } from "./auth/AuthProvider";

/**
 * The only place in the frontend that talks to the Spring Boot backend's business
 * endpoints. It forwards the session's access token as a bearer JWT and nothing else —
 * no Auth0-specific headers or SDK calls cross this boundary.
 */
export async function fetchFromBackend(
  path: string,
  session: AuthSession,
  init: RequestInit = {},
): Promise<Response> {
  const backendUrl = process.env.BACKEND_API_URL;
  if (!backendUrl) {
    throw new Error("BACKEND_API_URL is not set");
  }

  return fetch(`${backendUrl}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${session.accessToken}`,
    },
    cache: "no-store",
  });
}
