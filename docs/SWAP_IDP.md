# Swapping Auth0 for another OIDC provider

The whole point of the adapter layers in `backend/` and `frontend/` is that this should be a
config change, not a rewrite. This doc proves it by listing exactly what changes.

## Backend (`backend/`)

For any standard OIDC provider (Keycloak, Okta, Entra ID direct, another Auth0 tenant):

| File | Change |
|---|---|
| `backend/.env` (or your deployment's env vars) | `OIDC_ISSUER_URI` → the new provider's issuer, `OIDC_AUDIENCE` → the new provider's API/resource identifier |
| `backend/src/main/resources/application.yml` | `app.authorization.roles-claim` → whatever claim name the new provider uses for groups/roles; `app.authorization.role-mapping` → the new provider's group/role identifiers mapped to the same `ADMIN`/etc. app role names |

**Zero Java code changes.** `SecurityConfig` only ever reads `issuer-uri`/`audiences` from
config, and `GroupClaimAuthorityConverter` only ever reads `app.authorization.*` from config.

The only scenario that touches code: the new provider's role/group claim has a
**fundamentally different shape** than "a list of string identifiers" (e.g. it's a nested
object, or requires a follow-up API call to resolve). Even then, only
`backend/src/main/java/com/authbridge/backend/security/authorities/GroupClaimAuthorityConverter.java`
changes — it's the sole implementation of `ClaimToAuthorityConverter`. `SecurityConfig` and
`ProtectedController` stay untouched because they depend on the interface, not the
implementation.

## Frontend (`frontend/`)

| File | Change |
|---|---|
| `frontend/.env` | `OIDC_ISSUER_URI`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_REDIRECT_URI`, `OIDC_SCOPES`, `OIDC_AUDIENCE`, `OIDC_POST_LOGOUT_REDIRECT_URI` → the new provider's values |

**Zero TypeScript changes**, for the same reason as the backend: `oidcAuthProvider.ts` calls
`openid-client`'s `discovery()` with only `OIDC_ISSUER_URI` + client credentials, and every
other file (`proxy.ts`, the route handlers, the protected pages) depends on the
`AuthProvider` interface in `lib/auth/AuthProvider.ts`, never on `openid-client` or Auth0
directly.

The only scenario that touches code: a provider that isn't OIDC-discovery-compliant (no
`/.well-known/openid-configuration`) or that needs a non-standard token-endpoint auth method.
Even then, only `frontend/src/lib/auth/oidcAuthProvider.ts` changes — it's the sole
implementation of `AuthProvider`.

## What never changes, in either app

- The cookie/session mechanics (`frontend/src/lib/auth/session.ts`) — provider-agnostic by
  construction, it only knows about `AuthSession`'s shape, not where the tokens came from.
- Route protection (`frontend/src/proxy.ts`, `frontend/src/lib/auth/dal.ts`).
- The backend's request-authorization logic (`SecurityConfig`, `ProtectedController`).

## Example: replacing Auth0 with self-hosted Keycloak

1. Stand up Keycloak, create a realm and a confidential client.
2. `backend/.env`: `OIDC_ISSUER_URI=https://keycloak.example.com/realms/authbridge`,
   `OIDC_AUDIENCE=<keycloak client id or a configured audience mapper>`.
3. `backend/application.yml`: `app.authorization.roles-claim: realm_access.roles` — note
   Keycloak nests roles under `realm_access.roles` rather than a flat top-level claim; if
   `GroupClaimAuthorityConverter`'s use of `Jwt#getClaimAsStringList` can't reach a nested
   path directly, this is the one case above where the converter implementation needs a
   small change (a couple of lines to read the nested claim) — the interface and
   `SecurityConfig` still don't change.
4. `frontend/.env`: `OIDC_ISSUER_URI`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`,
   `OIDC_AUDIENCE` → the Keycloak equivalents.
5. Done. No component upstream of these env vars and the one converter file needs to know
   Keycloak exists.
