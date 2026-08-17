import * as client from "openid-client";
import type { AuthProvider, AuthSession, PkceTransaction } from "./AuthProvider";
import { createPkceTransaction } from "./pkce";

/**
 * The one and only file in this app that imports `openid-client`. Everything else — route
 * handlers, pages, proxy.ts — depends on the `AuthProvider` interface. Swapping Auth0 for
 * Keycloak, Okta, or Entra ID directly means either just changing the env vars below (any
 * standard OIDC provider) or, at most, replacing this one file.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Discovery (fetching /.well-known/openid-configuration) is a network call — cache the
// resulting Configuration for the lifetime of the server process instead of re-discovering
// it on every request.
let configPromise: Promise<client.Configuration> | null = null;

function getOidcConfig(): Promise<client.Configuration> {
  if (!configPromise) {
    configPromise = client.discovery(
      new URL(requireEnv("OIDC_ISSUER_URI")),
      requireEnv("OIDC_CLIENT_ID"),
      requireEnv("OIDC_CLIENT_SECRET"),
    );
  }
  return configPromise;
}

type TokenResponse = Awaited<ReturnType<typeof client.authorizationCodeGrant>>;

function tokensToSession(tokens: TokenResponse, fallback?: AuthSession): AuthSession {
  const claims = tokens.claims();
  const expiresIn = tokens.expiresIn();
  const nowSeconds = Math.floor(Date.now() / 1000);

  return {
    subject: (claims?.sub as string | undefined) ?? fallback?.subject ?? "",
    accessToken: tokens.access_token,
    accessTokenExpiresAt: nowSeconds + (expiresIn ?? 0),
    refreshToken: tokens.refresh_token ?? fallback?.refreshToken,
    idTokenClaims: (claims as Record<string, unknown> | undefined) ?? fallback?.idTokenClaims ?? {},
  };
}

export const oidcAuthProvider: AuthProvider = {
  async startLogin() {
    const config = await getOidcConfig();
    const { transaction, codeChallenge } = await createPkceTransaction();

    const authorizationUrl = client.buildAuthorizationUrl(config, {
      redirect_uri: requireEnv("OIDC_REDIRECT_URI"),
      scope: process.env.OIDC_SCOPES ?? "openid profile email offline_access",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      state: transaction.state,
      nonce: transaction.nonce,
      // Required so Auth0 issues a JWT access token instead of an opaque one — the
      // resource server can only validate JWTs. See docs/SETUP.md.
      audience: requireEnv("OIDC_AUDIENCE"),
    });

    return { authorizationUrl: authorizationUrl.toString(), pkce: transaction };
  },

  async handleCallback(currentUrl: URL, pkce: PkceTransaction) {
    const config = await getOidcConfig();
    const tokens = await client.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: pkce.codeVerifier,
      expectedState: pkce.state,
      expectedNonce: pkce.nonce,
    });
    return tokensToSession(tokens);
  },

  async refresh(session: AuthSession) {
    if (!session.refreshToken) {
      throw new Error("Session has no refresh token");
    }
    const config = await getOidcConfig();
    const tokens = await client.refreshTokenGrant(config, session.refreshToken);
    return tokensToSession(tokens, session);
  },

  async buildLogoutUrl(postLogoutRedirectUri: string) {
    const config = await getOidcConfig();
    const url = client.buildEndSessionUrl(config, {
      post_logout_redirect_uri: postLogoutRedirectUri,
    });
    return url.toString();
  },
};
