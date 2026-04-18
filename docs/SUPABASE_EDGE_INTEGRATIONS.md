# Supabase Edge Functions: Gmail (Google) integration

This project stores Google OAuth tokens for **Gmail** in `public.integration_credentials` (see `supabase/integration_credentials.sql`). Only Edge Functions using the **service role** key should read or write that table.

If you later add Microsoft (Graph, Outlook, etc.), use the `oauth-microsoft-*` functions and Azure redirect URIs documented in git history or re-add a short “Microsoft” section; this doc assumes **Gmail only**.

## Google Cloud: redirect URI

Register **exact** authorized redirect URIs on your **Web** OAuth 2.0 client (**APIs & services** → **Credentials**):

**Production**

```text
https://<PROJECT_REF>.supabase.co/functions/v1/oauth-google-callback
```

**Local Supabase** (optional; match `[api] port` in `supabase/config.toml`, often `54321`)

```text
http://127.0.0.1:54321/functions/v1/oauth-google-callback
```

If you set **`GOOGLE_REDIRECT_URI`** in Supabase secrets, it must match one of these entries **exactly**.

## Google Cloud: Gmail API and scopes

1. **APIs & services** → **Library** → enable **Gmail API** (and keep **Google+** / People if you rely on `userinfo`; OpenID userinfo is standard).
2. **OAuth consent screen**: add the scopes your app requests. Defaults in `oauth-google-start` are:
   - `openid`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.send`  
   Narrow or widen with secret **`GOOGLE_OAUTH_SCOPES`** (space-separated). If you only send mail and never read threads, you can drop `gmail.readonly` via that env var.

## Supabase invoke URL pattern

```text
https://<PROJECT_REF>.supabase.co/functions/v1/<function-name>
```

## Secrets (`supabase secrets set`)

**Usually auto-provided on hosted Edge:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

**Required for Gmail OAuth**

| Secret | Purpose |
|--------|--------|
| `OAUTH_STATE_SECRET` | Signs OAuth `state` on browser redirects (long random string). |
| `GOOGLE_CLIENT_ID` | Web client ID from Google Cloud. |
| `GOOGLE_CLIENT_SECRET` | Web client secret. |
| `APP_SITE_URL` | Dashboard origin (no trailing slash); user is redirected here after connect, e.g. `https://your-app.netlify.app`. |

**Optional**

| Secret | Purpose |
|--------|--------|
| `GOOGLE_OAUTH_SCOPES` | Overrides default Gmail scopes (space-separated). |
| `GOOGLE_REDIRECT_URI` | Overrides derived callback URL (must match Google Console). |
| `DASHBOARD_ALLOWED_ORIGINS` | CORS for browser calls to `oauth-google-start` (see `_shared/cors.ts`). |
| `INTEGRATION_TOKEN_ENCRYPTION_KEY` | AES-256-GCM on refresh tokens before DB write (`_shared/tokenCrypto.ts`). |
| `INTEGRATION_WORKER_SECRET` | Protects `integration-worker` (cron / server callers). |

Example (Gmail only):

```bash
supabase secrets set \
  OAUTH_STATE_SECRET="$(openssl rand -base64 32)" \
  GOOGLE_CLIENT_ID="..." \
  GOOGLE_CLIENT_SECRET="..." \
  APP_SITE_URL="https://your-dashboard.example" \
  INTEGRATION_WORKER_SECRET="$(openssl rand -base64 32)"
```

## Deploy (Gmail path)

```bash
supabase functions deploy oauth-google-start oauth-google-callback integration-worker
```

`supabase/config.toml` sets `verify_jwt = false` on **`oauth-google-callback`** and **`integration-worker`** so the provider and cron do not send a Supabase JWT. **`oauth-google-start`** keeps JWT verification (user must be signed in).

## Dashboard flow

1. Signed-in client calls **`oauth-google-start`** with `Authorization: Bearer <supabase_access_token>` (POST JSON optional: `organization_id`, `return_path`).
2. Response JSON includes `{ "url": "..." }` — set `window.location` (or open) that URL.
3. Google redirects to **`oauth-google-callback`** with `code` and `state`.
4. Callback stores tokens and redirects to `APP_SITE_URL` + `return_path` (default `/settings/integrations`) with query `oauth=ok` or `oauth=error`.

## Cron / schedules

Invoke **`integration-worker`** on a schedule with header `x-integration-worker-secret: <INTEGRATION_WORKER_SECRET>` or `Authorization: Bearer <same>`. See `supabase/cron_integration_worker.sql` for a commented `pg_cron` example.

## Database

1. `supabase/organizations_multitenancy.sql`
2. `supabase/integration_credentials.sql`

## Vault (optional)

See `supabase/optional_vault_encryption_notes.sql` for Vault / pgsodium vs app-level `INTEGRATION_TOKEN_ENCRYPTION_KEY`.
