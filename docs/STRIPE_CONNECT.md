# Stripe Connect (workspaces)

This dashboard routes **invoice Checkout** to each workspace’s **Stripe Connect Express** account and records **paid** amounts as income on the linked revenue transaction (or as a new transaction when there is no invoice).

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
