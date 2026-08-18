# Setup: Auth0 tenant + Microsoft Entra ID + custom OIDC connection

This walks through the three things you need before either app's `.env` will work:
an Auth0 tenant + application + API, an app registration in Microsoft Entra ID, and
connecting the two as a **custom OIDC social connection**.

> **Read this warning before you touch the Auth0 dashboard.** Auth0's free ("Free") plan
> gives you Social Connections and regular Applications/APIs at no cost. It does **not**
> include Enterprise Connections. Auth0 ships a dedicated **"Microsoft Entra ID"** (formerly
> "Azure AD") tile under **Authentication → Enterprise** — that tile provisions an
> *Enterprise Connection*, which is a paid feature. The moment it has real login activity,
> it counts against Monthly Active Enterprise Users and can put a free-tier tenant
> over-quota. **Do not use it.** Everything below uses **Authentication → Social → Create
> Custom → OpenID Connect** instead, which is a Social Connection (free) that happens to
> point at Entra's standard OIDC endpoints. Functionally, for this project, it's the same
> "log in with your Microsoft/corporate account" experience — just billed differently.

## (a) Auth0: tenant, application, and API

1. Create a free Auth0 tenant at https://auth0.com if you don't have one.
2. **Applications → Applications → Create Application.** Name it (e.g. `authbridge`), choose
   **Regular Web Application**. This is a confidential client (it has a client secret) that
   still uses Authorization Code + PKCE — that's exactly what `frontend/`'s adapter does.
3. In the application's **Settings** tab, note the **Domain**, **Client ID**, and **Client
   Secret** — these become `OIDC_ISSUER_URI` (as `https://<domain>/`, trailing slash),
   `OIDC_CLIENT_ID`, and `OIDC_CLIENT_SECRET` in `frontend/.env`.
4. Set:
   - **Allowed Callback URLs**: `http://localhost:3000/api/auth/callback`
   - **Allowed Logout URLs**: `http://localhost:3000/`
   - **Allowed Web Origins**: `http://localhost:3000`

   (add your production URLs alongside these once you deploy).
5. **Applications → APIs → Create API.** This represents the Spring Boot backend. Give it a
   name and an **Identifier** — e.g. `https://api.authbridge.local`. The identifier doesn't
   need to be a real, reachable URL; it's just a stable string Auth0 uses as the `aud` claim.
   This value becomes `OIDC_AUDIENCE` in **both** `backend/.env` and `frontend/.env` — they
   must match exactly.

   > **Why this step matters**: if the frontend doesn't send an `audience` parameter that
   > matches a registered API, Auth0 issues an **opaque** access token instead of a JWT, and
   > `spring-boot-starter-oauth2-resource-server` has nothing to validate. The frontend's
   > `oidcAuthProvider.ts` already sends `audience` on every `/authorize` call — you just
   > need the API to exist so that audience is valid.
6. Leave the API's signing algorithm as the default (RS256) — the backend's
   `issuer-uri`-based JWKS discovery expects asymmetric signing.

## (b) Microsoft Entra ID: app registration

1. In the [Entra admin center](https://entra.microsoft.com), go to **App registrations → New
   registration**.
2. Name it (e.g. `authbridge`). Under **Supported account types**, pick whichever fits your
   tenant (single-tenant is fine for a demo).
3. **Redirect URI**: platform **Web**, value `https://YOUR_TENANT.auth0.com/login/callback`
   — this fixed path (not a URL you choose) is where Auth0 expects the upstream IdP to send
   the browser back for a custom OIDC connection.
4. After creation, note the **Application (client) ID** and **Directory (tenant) ID** from
   the Overview page.
5. **Certificates & secrets → New client secret.** Copy its value immediately — you won't
   see it again. This and the client ID go into the Auth0 custom connection in step (c).
6. **API permissions**: add `openid`, `profile`, `email` (Microsoft Graph, delegated) — these
   are enabled by default for most registrations but confirm they're present and consented.
7. **App roles → Create app role.** This is the recommended way (over Group Claims) to get
   role information into the token on the free tier: it doesn't require Microsoft Graph API
   calls or hit the 200-group overage limit that Entra's group *claims* have. Create a role
   (e.g. display name `Admin`, value `admin`, allowed member type `Users/Groups`).
8. **Enterprise applications → (your app) → Users and groups → Add user/group**, and assign
   a test user to the `Admin` app role you just created.
9. **Token configuration → Add groups claim** is the alternative if you'd rather use security
   groups instead of app roles — either way, **Entra emits a GUID**, not a human-readable
   name, as the claim value. That's exactly what `backend/src/main/resources/application.yml`'s
   `app.authorization.role-mapping` (a GUID → role-name map) exists to translate.

## (c) Connect Entra to Auth0 as a custom OIDC connection

1. In Auth0: **Authentication → Social → Create Custom**. Choose **OpenID Connect** as the
   connection type. (This is *not* the "Microsoft"/"Azure AD" tile under Enterprise
   Connections — see the warning at the top of this doc.)
2. **Discovery URL**:
   `https://login.microsoftonline.com/{your-tenant-id}/v2.0/.well-known/openid-configuration`
3. **Client ID** / **Client Secret**: from the Entra app registration (step b.5).
4. **Scopes**: `openid profile email`.
5. Enable this connection for your Auth0 application (the toggle on the connection's
   "Applications" tab).
6. **Fetch User Profile Script**: custom OIDC connections let you normalize the profile
   Auth0 receives from the upstream IdP. Use this to capture the app-role/group claim Entra
   put in its ID token or userinfo response into `app_metadata`, so a Login Action (next
   step) can read it:

   ```js
   function fetchUserProfile(accessToken, ctx, cb) {
     // `ctx.id_token` / the userinfo response carries Entra's `roles` (app roles) or
     // `groups` claim depending on which you configured in step (b).
     const entraRoles = ctx.id_token?.roles || [];
     cb(null, {
       user_id: ctx.id_token.sub,
       email: ctx.id_token.email,
       app_metadata: { entra_roles: entraRoles },
     });
   }
   ```

7. **Actions → Library → Build Custom → Login / Post Login.** Add an Action that copies the
   captured roles into a **namespaced** custom claim on the token (Auth0 requires custom
   claims to be a URI-shaped namespace, e.g. `https://authbridge.app/groups`) — this must
   match `AUTHZ_ROLES_CLAIM` in `backend/.env` and `backend/src/main/resources/application.yml`:

   ```js
   exports.onExecutePostLogin = async (event, api) => {
     const entraRoles = event.user.app_metadata?.entra_roles || [];
     api.accessToken.setCustomClaim('https://authbridge.app/groups', entraRoles);
     api.idToken.setCustomClaim('https://authbridge.app/groups', entraRoles);
   };
   ```

   Deploy the Action and add it to the **Login** flow (Actions → Flows → Login → drag it in).
8. Back in `backend/src/main/resources/application.yml`, add the Entra app-role/group GUID
   you assigned in step (b.8) to `app.authorization.role-mapping`, e.g.:

   ```yaml
   app:
     authorization:
       role-mapping:
         11111111-2222-3333-4444-555555555555: ADMIN
   ```

## Free-tier checklist

| Component | Free? | Notes |
|---|---|---|
| Auth0 tenant, Regular Web App, API | Yes | Free plan includes these |
| Auth0 Social Connection (custom OIDC) | Yes | This is what connects to Entra here |
| Auth0 Enterprise Connection ("Microsoft"/"Azure AD" tile) | **No** | Avoid entirely — see warning above |
| Entra ID app registration, App Roles | Yes | Included in Entra ID Free |
| Entra ID Enterprise Connection SSO (if used instead) | Depends | Only relevant if you use Auth0's Enterprise tile, which this guide avoids |

## Local `.env` values

Once the above is done, `backend/.env` needs `OIDC_ISSUER_URI`, `OIDC_AUDIENCE`, and
`AUTHZ_ROLES_CLAIM` (see `backend/.env.example`), and `frontend/.env` needs the full set in
`frontend/.env.example` — the Auth0 domain/client id/secret/audience from step (a), plus a
`COOKIE_SECRET` you generate yourself (e.g. `openssl rand -base64 32`).
