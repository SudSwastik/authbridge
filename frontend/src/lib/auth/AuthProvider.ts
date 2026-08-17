/**
 * The vendor-neutral seam: every route handler and page depends on these types and on the
 * `AuthProvider` interface, never on `openid-client` or any Auth0-specific API directly.
 * `oidcAuthProvider.ts` is the only file that imports `openid-client`; swapping identity
 * providers means writing a new implementation of this interface (or, for a standard OIDC
 * provider, just changing env vars — see docs/SWAP_IDP.md).
 */

export interface PkceTransaction {
  state: string;
  nonce: string;
  codeVerifier: string;
}

export interface AuthSession {
  subject: string;
  accessToken: string;
  /** Epoch seconds. Compared against `Date.now()` to decide when to refresh. */
  accessTokenExpiresAt: number;
  refreshToken?: string;
  idTokenClaims: Record<string, unknown>;
}

export interface AuthProvider {
  /** Builds the /authorize redirect URL and the PKCE transaction to persist alongside it. */
  startLogin(): Promise<{ authorizationUrl: string; pkce: PkceTransaction }>;
  /** Exchanges the callback's authorization code for tokens, verifying state/nonce/PKCE. */
  handleCallback(currentUrl: URL, pkce: PkceTransaction): Promise<AuthSession>;
  /** Uses the session's refresh token to obtain a new access token (silent refresh). */
  refresh(session: AuthSession): Promise<AuthSession>;
  /** Builds the provider's RP-Initiated Logout URL. */
  buildLogoutUrl(postLogoutRedirectUri: string): Promise<string>;
}
