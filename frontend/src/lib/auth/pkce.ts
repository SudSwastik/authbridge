import * as client from "openid-client";
import type { PkceTransaction } from "./AuthProvider";

/**
 * Generates the Authorization Code + PKCE transaction: a code_verifier/code_challenge pair
 * (RFC 7636), plus `state` and `nonce` for CSRF and ID-token-replay protection. Uses
 * openid-client's own random-value helpers rather than hand-rolled crypto.
 */
export async function createPkceTransaction(): Promise<{
  transaction: PkceTransaction;
  codeChallenge: string;
}> {
  const codeVerifier = client.randomPKCECodeVerifier();
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
  const state = client.randomState();
  const nonce = client.randomNonce();

  return {
    transaction: { state, nonce, codeVerifier },
    codeChallenge,
  };
}
