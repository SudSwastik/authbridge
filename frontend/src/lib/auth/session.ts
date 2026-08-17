import { EncryptJWT, jwtDecrypt } from "jose";
import type { AuthSession, PkceTransaction } from "./AuthProvider";

/**
 * Cookie encryption for both the real session and the short-lived PKCE transaction. Uses
 * `jose` (Web Crypto only, no `node:crypto`) so this module has zero dependency on
 * `openid-client` and stays safe to import from proxy.ts.
 *
 * IMPORTANT for horizontal scaling: COOKIE_SECRET must be byte-for-byte identical across
 * every running instance — a session encrypted by one instance must decrypt on any other,
 * or users get logged out whenever the load balancer routes them to a different instance.
 */

export const SESSION_COOKIE_NAME = "authbridge_session";
export const PKCE_COOKIE_NAME = "authbridge_pkce_txn";

// This bounds the encrypted cookie itself, independent of accessTokenExpiresAt carried
// inside its payload. It is deliberately generous — the access token's own expiry (checked
// separately, see proxy.ts) is what actually drives re-authentication/refresh.
export const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
// Just long enough for the /authorize -> Entra -> Auth0 -> /callback round trip.
export const PKCE_COOKIE_MAX_AGE_SECONDS = 60 * 10; // 10 minutes

export interface PkceCookiePayload extends PkceTransaction {
  /** Same-origin path to return to once login completes. */
  redirectTo: string;
}

async function deriveEncryptionKey(): Promise<Uint8Array> {
  const secret = process.env.COOKIE_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "COOKIE_SECRET must be set to a long random string (see frontend/.env.example) and " +
        "must be identical across every instance when running more than one.",
    );
  }
  // SHA-256 always yields exactly the 32 bytes A256GCM needs, regardless of the raw
  // secret's length. crypto.subtle is Web Crypto, available in every Next.js runtime.
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return new Uint8Array(digest);
}

async function encryptPayload(
  payload: Record<string, unknown>,
  maxAgeSeconds: number,
): Promise<string> {
  const key = await deriveEncryptionKey();
  return new EncryptJWT(payload)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + maxAgeSeconds)
    .encrypt(key);
}

async function decryptPayload<T>(token: string): Promise<T | null> {
  try {
    const key = await deriveEncryptionKey();
    const { payload } = await jwtDecrypt(token, key);
    return payload as T;
  } catch {
    // Tampered ciphertext, wrong key, and an expired cookie all land here — treated
    // identically as "no valid session," never a 500.
    return null;
  }
}

export function encryptSession(session: AuthSession): Promise<string> {
  return encryptPayload({ ...session }, SESSION_COOKIE_MAX_AGE_SECONDS);
}

export function decryptSession(token: string): Promise<AuthSession | null> {
  return decryptPayload<AuthSession>(token);
}

export function encryptPkceTransaction(payload: PkceCookiePayload): Promise<string> {
  return encryptPayload({ ...payload }, PKCE_COOKIE_MAX_AGE_SECONDS);
}

export function decryptPkceTransaction(token: string): Promise<PkceCookiePayload | null> {
  return decryptPayload<PkceCookiePayload>(token);
}
