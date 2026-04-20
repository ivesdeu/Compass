# Edge Function authorization contract

Supabase Edge Functions that use **`SUPABASE_SERVICE_ROLE_KEY`** bypass Postgres RLS. Every such function must implement explicit **authenticate → authorize org → scope writes**.

## Required pattern

1. **Authenticate:** `createClient(url, anonKey, { global: { headers: { Authorization } } })` then `auth.getUser(jwt)` (pass JWT explicitly).
2. **Authorize:** Query `organization_members` (with the **user** client) for `organization_id` + `user_id`, or validate signed OAuth `state` / Stripe signature before trusting metadata.
3. **Scope:** Every `admin.from(...)` read/update must filter by the resolved `organization_id` (and `user_id` for per-user integration rows).
4. **Never** apply service-role writes using only client-supplied IDs without step 2.

## Audit checklist

| Function | Auth | Org / trust boundary | Status |
|----------|------|------------------------|--------|
| [`accept-org-invite`](../supabase/functions/accept-org-invite/index.ts) | JWT | Invite token + email match; admin upsert to `organization_members` for **that** invite’s org | Pass |
| [`ai-assistant`](../supabase/functions/ai-assistant/index.ts) | JWT | **No service role.** Membership + viewer rejection before model call | Pass |
| [`create-stripe-checkout-session`](../supabase/functions/create-stripe-checkout-session/index.ts) | JWT | Membership + write role; invoice loaded with `.eq('organization_id', body.organizationId)` | Pass |
| [`gmail-send`](../supabase/functions/gmail-send/index.ts) | JWT | `resolveOrganizationId`; tokens from `integration_credentials` keyed by user+org | Pass |
| [`integration-worker`](../supabase/functions/integration-worker/index.ts) | Shared secret | No user JWT — **cron only**; must not expose to browsers. Count query is global (tighten when adding per-org work) | Pass (documented risk) |
| [`oauth-google-callback`](../supabase/functions/oauth-google-callback/index.ts) / [`oauth-microsoft-callback`](../supabase/functions/oauth-microsoft-callback/index.ts) | Signed `state` (HMAC) | `verifyOAuthState`; upsert scoped to `payload.o` / `payload.u` | Pass |
| [`oauth-google-start`](../supabase/functions/oauth-google-start/index.ts) / [`oauth-microsoft-start`](../supabase/functions/oauth-microsoft-start/index.ts) | JWT | `resolveOrganizationId` before redirect | Pass |
| [`organization-team`](../supabase/functions/organization-team/index.ts) | JWT | `getCallerMembership` before any admin action | Pass |
| [`stripe-webhook`](../supabase/functions/stripe-webhook/index.ts) | Stripe signature | Invoice row `organization_id` must match `metadata.organization_id` before update | Pass |

## Related docs

- [RLS_AND_TENANCY.md](RLS_AND_TENANCY.md) — database-side enforcement.  
- [DEPLOYMENT_ORG_ROUTING.md](DEPLOYMENT_ORG_ROUTING.md) — hosting and secrets.
