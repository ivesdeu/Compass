# Stripe Connect (workspaces)

This dashboard routes **invoice Checkout** to each workspace’s **Stripe Connect Express** account and records **paid** amounts as income on the linked revenue transaction (or as a new transaction when there is no invoice).

## Client-ready checklist (operator)

Work through in order. The static app must use the **same** Supabase project as Edge secrets and migrations (`VITE_SUPABASE_*` in [`.env.example`](../.env.example); defaults in [`vite.config.mjs`](../vite.config.mjs) match the linked IDM project).

1. **Database** — Link the CLI (`supabase link --project-ref <ref>`), then `npm run db:push` (or `npm run db:push:all` if the CLI reports migrations “inserted before” the remote tip—review output first). Migrations must include multitenancy before [`20260301107100_organization_stripe_connect.sql`](../supabase/migrations/20260301107100_organization_stripe_connect.sql).
2. **Supabase Auth URLs** — Dashboard → **Authentication** → **URL configuration**:
   - **Site URL:** your production dashboard origin (e.g. `https://your-host.com`), or `http://localhost:5173` for local-only.
   - **Redirect URL allow list:** production origin, `http://localhost:5173`, `http://127.0.0.1:5173`, and any preview origins you use. Org slug paths (`https://host/your-org/`) stay same-origin; see [`docs/DEPLOYMENT_ORG_ROUTING.md`](DEPLOYMENT_ORG_ROUTING.md) for Safari / OAuth notes.
3. **Frontend build** — Copy `.env.example` to `.env`, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the target project, then `npm run build` and deploy `dist/` (e.g. Netlify). Mismatched project vs Edge causes **401** on `stripe-connect-start`.
4. **Edge secrets** — Dashboard → **Edge Functions** → **Secrets** (or `supabase secrets set --project-ref <ref> …`). Required names: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `APP_BASE_URL`, `DASHBOARD_ALLOWED_ORIGINS`. Optional: `STRIPE_CONNECT_DEFAULT_COUNTRY`. Verify digests with `supabase secrets list --project-ref <ref>`.
5. **Deploy Edge Functions** — `export SUPABASE_PROJECT_REF=<ref>` then `npm run deploy:edge` (see [`scripts/deploy-edge-functions.sh`](../scripts/deploy-edge-functions.sh)).
6. **Stripe Dashboard (platform)** — Connect Express, redirect allowlist for `APP_BASE_URL`, platform webhook to `https://<ref>.supabase.co/functions/v1/stripe-webhook` with **events on connected accounts** (see below).
7. **Smoke test** — Sign in as **owner** or **admin** → **Settings → Stripe** → **Continue Stripe setup** (expect **200** and redirect to Stripe). Complete test onboarding; confirm webhook deliveries **200** in Stripe; use **Pay now** on an invoice in test mode and confirm invoice / income updates.

## Prerequisites

1. Apply migration [`20260301107100_organization_stripe_connect.sql`](../supabase/migrations/20260301107100_organization_stripe_connect.sql) via `supabase db push` (after multitenancy so `organizations` and helpers exist). See [`docs/DEPLOYMENT_ORG_ROUTING.md`](DEPLOYMENT_ORG_ROUTING.md).
2. Deploy Edge functions: `create-stripe-checkout-session`, `stripe-webhook`, `stripe-connect-start`, `stripe-connect-disconnect`.
3. In the Stripe Dashboard (platform account): enable **Connect**, choose **Express**, and add **redirect URLs** that match your app (see below).

## Secrets (Supabase project → Edge Functions)

| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` | Platform secret key (same as today). |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for your **platform** webhook endpoint. |
| `SUPABASE_URL` | Project URL. |
| `SUPABASE_ANON_KEY` | Anon key (JWT validation in user-facing functions). |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (database writes from webhooks and Connect flows). |
| `APP_BASE_URL` | Site origin used for Checkout success/cancel URLs and Connect **Account Link** refresh/return URLs (no trailing slash). Optional `STRIPE_CONNECT_DEFAULT_COUNTRY` (ISO 2-letter, default `US`) for new Express accounts. |

## Stripe Dashboard configuration

1. **Connect → Settings**  
   - Complete Connect application if prompted.  
   - Allowed redirect domains should include your dashboard host (the URLs built from `APP_BASE_URL`).

   **Compass (`https://compass-login.ivesdeu.com`):** set Supabase Edge secret `APP_BASE_URL` to `https://compass-login.ivesdeu.com` (no trailing slash). Stripe Account Links use these exact return URLs—allowlist them in Connect settings if Stripe requires full URLs:

   - `https://compass-login.ivesdeu.com/?settings=1&stripe_panel=stripe&stripe_return=1` (return)  
   - `https://compass-login.ivesdeu.com/?settings=1&stripe_panel=stripe&stripe_refresh=1` (refresh)

2. **Developers → Webhooks (platform)**  
   - Endpoint URL: `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`  
   - **Listen to events on Connected accounts** (required for Connect Checkout and `payment_intent.succeeded` on the connected account).  
   - Events to send at minimum:  
     - `checkout.session.completed`  
     - `checkout.session.expired`  
     - `account.updated`  
     - `payment_intent.succeeded`  

3. **Test vs live**  
   - Use test keys and [Stripe CLI](https://stripe.com/docs/stripe-cli) forwarding for local verification.  
   - Webhook retries must not double-count income: the database enforces one row per `(organization_id, stripe_payment_intent_id)` for automatic inserts.

## Operator notes

- **Settings → Stripe**: only **owners** and **admins** can start onboarding or disconnect. **Members** can still use **Pay now** once charges are enabled.  
- **Pay now** is blocked until Connect onboarding completes and **charges** are enabled (`409` with `STRIPE_CONNECT_REQUIRED` from `create-stripe-checkout-session`).  
- **Disconnect** removes the row in `organization_stripe_connections` and calls Stripe’s **delete connected account** when possible; historical Stripe objects remain in Stripe.  
- **Compliance**: Express onboarding is Stripe-hosted; confirm your product copy and Stripe’s current Connect documentation for merchant-of-record and disclosure requirements in your jurisdiction.

## Related

- `docs/SUPABASE_EDGE_INTEGRATIONS.md` — pattern for `APP_BASE_URL` and hosted integrations.
