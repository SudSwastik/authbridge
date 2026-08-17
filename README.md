# AuthBridge

A reference implementation of a production-grade authentication system built entirely on
free tiers, with **no vendor lock-in**: the frontend and backend speak only standard
OIDC/OAuth2/JWT. Auth0 sits behind a thin adapter layer in each app, so it can be replaced
by Keycloak, Okta, or Entra ID directly by changing configuration and one adapter file —
never business logic.

## Stack

| Layer            | Technology                                                        |
|-------------------|--------------------------------------------------------------------|
| Frontend          | Next.js (App Router, TypeScript), server-side httpOnly-cookie sessions |
| Backend           | Spring Boot (Java 21), stateless OAuth2 resource server            |
| Identity broker   | Auth0 (free tier)                                                   |
| Upstream IdP      | Microsoft Entra ID (free), connected to Auth0 as a **custom OIDC social connection** — not the paid Enterprise Connection tile |

## Architecture

```
                 ┌──────────────────────────┐
   user  ─────►  │   Next.js frontend        │
                 │   (Authorization Code     │
                 │    + PKCE, httpOnly       │
                 │    session cookie)        │
                 └───────────┬───────────────┘
                              │ 1. redirect to /authorize
                              ▼
                 ┌──────────────────────────┐
                 │   Auth0 (identity broker) │
                 └───────────┬───────────────┘
                              │ 2. federates to custom OIDC connection
                              ▼
                 ┌──────────────────────────┐
                 │  Microsoft Entra ID       │
                 │  (upstream corporate IdP) │
                 └───────────┬───────────────┘
                              │ 3. user authenticates, groups/roles
                              │    copied into the token via an
                              │    Auth0 Action
                              ▼
                 back to Auth0 → callback → Next.js exchanges
                 code for tokens, sets an encrypted httpOnly
                 session cookie
                              │
                              │ 4. subsequent page loads / API calls
                              │    forward the access token as a
                              │    bearer JWT
                              ▼
                 ┌──────────────────────────┐
                 │  Spring Boot backend      │
                 │  (stateless JWT resource  │
                 │   server — verifies       │
                 │   signature/iss/aud via   │
                 │   JWKS, maps claims to    │
                 │   GrantedAuthority)        │
                 └──────────────────────────┘
```

The backend never talks to Auth0 or Entra directly — it only validates JWTs against the
issuer's JWKS endpoint (auto-discovered from `issuer-uri`). The frontend never talks to the
backend's business logic during login — it only exchanges an authorization code for tokens
and stores them in an encrypted cookie.

## Repository layout

```
authbridge/
  backend/    Spring Boot resource server — see backend/src for SecurityConfig, the
              pluggable claim → GrantedAuthority converter, and sample protected endpoints
  frontend/   Next.js app — auth adapter, PKCE login/callback/logout routes, protected pages
  docs/
    SETUP.md          Auth0 tenant + Entra app registration + custom OIDC connection, step by step
    SWAP_IDP.md        exactly which files change to replace Auth0 with another OIDC provider
    E2E_TEST_PLAN.md   manual QA scenarios, including failure cases (expired/tampered/wrong-audience tokens)
  docker-compose.yml
```

`frontend/` and `docs/` are landing in follow-up commits; `backend/` is complete.

## Quick start

Each app is configured entirely through environment variables — copy the `.env.example`
file in `backend/` and `frontend/` to `.env` and fill in the values from your own Auth0
tenant (see `docs/SETUP.md` once it lands).

```bash
# backend only, for now
cd backend
cp .env.example .env   # fill in OIDC_ISSUER_URI / OIDC_AUDIENCE / AUTHZ_ROLES_CLAIM
mvn spring-boot:run
```

Once the frontend and `docker-compose.yml` land, the full stack will run with:

```bash
docker compose up --build
```

## Why no vendor lock-in

- **Backend**: `spring-boot-starter-oauth2-resource-server` validates JWTs using only
  `issuer-uri` (JWKS auto-discovery) and `audiences` — standard OIDC, no Auth0 SDK. Claim →
  role mapping goes through a single `ClaimToAuthorityConverter` interface, so a differently
  shaped claim from another IdP means implementing one interface, not touching
  `SecurityConfig` or any controller.
- **Frontend**: the OIDC client is the generic `openid-client` library (not
  `@auth0/nextjs-auth0`), driven purely by `OIDC_ISSUER_URI` and friends, wrapped behind an
  `AuthProvider` interface that the rest of the app depends on.

See `docs/SWAP_IDP.md` (landing soon) for the exact file-by-file diff of moving off Auth0.
