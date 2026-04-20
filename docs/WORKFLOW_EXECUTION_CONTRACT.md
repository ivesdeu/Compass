# Workflow execution contract (Compass)

Workflow automation tables are defined in [`20260301110000_workflow_automation.sql`](../supabase/migrations/20260301110000_workflow_automation.sql) and extended for multitenancy in [`20260301107000_organizations_multitenancy.sql`](../supabase/migrations/20260301107000_organizations_multitenancy.sql).

## Semantics

- **At-least-once delivery** is assumed for external triggers (Stripe webhooks, future cron workers). Runners must use an **idempotency key** so duplicate deliveries do not double-apply side effects.
- **Idempotency:** `workflow_runs` enforces uniqueness on **`(organization_id, idempotency_key)`** (replacing the older user-only unique where migrated). Every runner should compute a stable key from `(rule_id, external_event_id, time_bucket)` as appropriate.

## Run lifecycle

| Field | Meaning |
|-------|---------|
| `status` | Stored as text; use values like `success`, `error`, `pending` consistently in workers. |
| `error` | Human-readable message when `status` indicates failure. Must be safe to show operators (no secrets). |

## User-visible failure

- **Silent failure is unacceptable** for paid workflows: if a run fails, `workflow_runs.error` should be populated and the product should surface failures in **Tasks**, **Insights**, or a dedicated **Workflow** health area when that UI exists.
- Until a dashboard exists, **logs** (Edge Functions, Postgres) are the contract: search by `organization_id` and `rule_id`.

## Dry-run (future)

- New rules should support **evaluation-only** mode (condition matches without enqueueing side effects) before `enabled = true`.

## Rate limits

- Outbound channels (email, Gmail API, webhooks) should be **per-organization** throttled to avoid blast-radius incidents.

## Related

- [EDGE_FUNCTION_AUTH.md](EDGE_FUNCTION_AUTH.md) — service-role gates.  
- [RLS_AND_TENANCY.md](RLS_AND_TENANCY.md) — who can read/write `workflow_*` rows.
