# End-to-end test plan

This is a manual QA checklist, not automated test code — a real run needs a live Auth0
tenant federated to a real Entra ID tenant with real credentials (see `SETUP.md`), which
can't run unattended in CI. Run this once after setup, and again after any change to the
auth adapters.

Prerequisites: both apps running (`docker compose up --build`, or each `mvn spring-boot:run`
/ `npm run dev` individually) with `.env` filled in per `SETUP.md`, and at least one Entra
test user assigned the `Admin` app role.

## Happy path

1. **Visit the home page** (`http://localhost:3000/`). Expect: "Log in" link, no session.
2. **Click "Log in".** Expect: redirect to Auth0's `/authorize`, which immediately redirects
   to the Entra custom connection's Microsoft sign-in page (not Auth0's own login form).
3. **Sign in with Microsoft credentials** at the Entra prompt.
4. **Entra redirects back to Auth0**, which redirects to
   `http://localhost:3000/api/auth/callback?code=...&state=...`.
5. **Expect**: the browser lands back on the page you started from (or `/` by default) with
   a session cookie set (`authbridge_session`, httpOnly — check via DevTools → Application →
   Cookies, not `document.cookie`, since it's httpOnly).
6. **Verify the JWT has mapped claims**: visit `/protected`. Expect the page to render the
   backend's `GET /api/protected/hello` response body, including an `authorities` array. If
   your test user is assigned the `Admin` app role and the GUID is in
   `backend/application.yml`'s `role-mapping`, expect `"ROLE_ADMIN"` in that array.
7. **Protected Next.js route**: confirm `/protected` did *not* redirect to login — proves
   `proxy.ts` and `requireSession()` both saw a valid session.
8. **Authenticated backend call**: the JSON body rendered on `/protected` came from the
   Spring Boot backend validating the bearer JWT — confirm the backend's own logs show a
   200 on `GET /api/protected/hello`, not a 401/403.
9. **Role-gated route**: visit `/protected/admin`. If your user has the mapped `ADMIN` role,
   expect the backend's `GET /api/protected/admin/ping` JSON. If not, expect the page's
   403 explanation text (see "Missing group claim" below).
10. **Token refresh**: wait until the access token is within 60 seconds of expiry (or
    temporarily lower `REFRESH_THRESHOLD_SECONDS`/the token TTL in the Auth0 API settings
    to make this fast to test), then reload `/protected`. Expect: a brief redirect through
    `/api/auth/refresh` and back, landing on the same page, still authenticated — this is
    the silent refresh, driven server-side with no visible interruption.
11. **Logout**: click "Log out". Expect: the `authbridge_session` cookie is cleared, the
    browser is redirected through Auth0's RP-Initiated Logout endpoint, and back to `/`
    showing "Log in" again.
    - If `UPSTREAM_END_SESSION_URL` is configured (chained logout to Entra): expect an
      additional redirect hop through Entra's own logout endpoint. **This is best-effort** —
      Auth0 free-tier custom social OIDC connections don't have first-class federated
      logout the way paid Enterprise connections do. Verify by trying to log in again
      immediately: if Entra silently re-authenticates you without prompting for credentials,
      the upstream Entra session survived logout (a known limitation, not a bug in this
      code) — document this if it happens rather than trying to "fix" it further.

## Failure cases

### Expired token
- Manually reduce the Auth0 API's access token lifetime to something very short (e.g. 30s)
  for this test, or wait out a normal-length token.
- Call the backend directly with an expired token:
  `curl -H "Authorization: Bearer <expired-token>" http://localhost:8080/api/protected/hello`
- **Expect**: `401 Unauthorized` from the backend (Spring's resource server rejects on `exp`).
- Via the app: reload `/protected` after expiry. Expect `proxy.ts` to catch the near-expiry
  window and route through `/api/auth/refresh` automatically (see "Token refresh" above) —
  you should not see a raw 401 in the browser during normal use.

### Wrong audience
- In Auth0, temporarily request a token without the correct `audience` (or for a different,
  unrelated API) — e.g. hit `/authorize` manually without the `audience` param.
- **Expect**: Auth0 issues an opaque (non-JWT) token, or a JWT with a different `aud`. Either
  way, `curl`-ing the backend with it returns `401 Unauthorized` —
  `spring.security.oauth2.resourceserver.jwt.audiences` in `application.yml` rejects it even
  if the signature and issuer are otherwise valid.

### Tampered token
- Take a valid access token and flip a character in the middle (breaking the signature).
- `curl -H "Authorization: Bearer <tampered-token>" http://localhost:8080/api/protected/hello`
- **Expect**: `401 Unauthorized` — JWKS signature verification fails before any claim is read.

### Cancelled login at Entra
- Start login, but click "Cancel" / close the tab / deny consent at the Microsoft sign-in
  prompt instead of completing it.
- **Expect**: Entra redirects back to Auth0, which redirects to
  `http://localhost:3000/api/auth/callback?error=...`. The app must show the login-failed
  message on `/` (via the `login_error` query param) and **must not** create a session
  cookie — confirm no `authbridge_session` cookie exists in DevTools afterward.

### Missing group claim
- Sign in as an Entra user who is **not** assigned the `Admin` app role (or any mapped
  role/group).
- **Expect**: login still succeeds (the user is authenticated) and `/protected` still works
  (general authenticated endpoint, no role required). `/protected/admin` returns the
  backend's `403 Forbidden` (via `@PreAuthorize("hasRole('ADMIN')")`), and the frontend shows
  the explanatory message rather than crashing — confirm it's a handled 403 in the page, not
  an unhandled exception or a 500.
