# AuthBridge — frontend

Next.js (App Router, TypeScript) OIDC frontend. See the [repo root README](../README.md) for
the overall architecture, and [`docs/SETUP.md`](../docs/SETUP.md) for configuring Auth0/Entra.

```bash
cp .env.example .env   # fill in values from your Auth0 tenant
npm install
npm run dev
```

Auth-relevant code lives under `src/lib/auth/` (the `AuthProvider` interface and its
`openid-client`-based implementation, session-cookie encryption, PKCE), `src/proxy.ts`
(optimistic route protection), and `src/app/api/auth/*` (login/callback/refresh/logout).
