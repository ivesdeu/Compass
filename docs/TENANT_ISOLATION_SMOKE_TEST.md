# Tenant isolation smoke test (manual)

Automated policy presence: run [`supabase/tests/tenant_isolation_rls_check.sql`](../supabase/tests/tenant_isolation_rls_check.sql) after migrations.

## Manual JWT test (two users, two orgs)

Goal: prove User A **cannot** read or write User B’s org rows when both use the **anon key + JWT** (PostgREST + RLS).

1. Create **User A** and **User B** (Auth) and ensure each has a distinct organization (or invite B into a second workspace).
2. As **User A** (JWT in Supabase client or REST):
   - `insert` a row into `clients` with `organization_id = OrgA`.
3. As **User B** with JWT:
   - `select * from clients where organization_id = OrgA` → **expect 0 rows** (or RLS error if misconfigured).
4. As **User B**, attempt `update` or `delete` on A’s client id (if somehow known) → **expect failure**.

Repeat for `transactions` or `workspace_tasks` if those are critical paths.

## Edge API test

- Call `gmail-send` or `create-stripe-checkout-session` with a valid JWT for User A but **`organization_id` = Org B** → **expect 403** (membership check).

## Related

- [RLS_AND_TENANCY.md](RLS_AND_TENANCY.md)  
- [EDGE_FUNCTION_AUTH.md](EDGE_FUNCTION_AUTH.md)
