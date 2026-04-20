-- Automated sanity check: org-scoped RLS policies exist on core tenant tables.
-- Run in Supabase SQL editor (postgres) after organizations_multitenancy.sql.
-- Does not substitute for manual JWT tests with two real users.

DO $$
DECLARE
  missing int;
BEGIN
  SELECT count(*) INTO missing FROM (
    SELECT unnest(ARRAY[
      'clients', 'transactions', 'projects', 'invoices', 'campaigns',
      'workspace_tasks', 'crm_activities', 'workflow_runs'
    ]) AS tbl
  ) t
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename = t.tbl
      AND p.policyname = 'org_row_select'
  );

  IF missing > 0 THEN
    RAISE EXCEPTION 'tenant_isolation_rls_check: missing org_row_select on % table(s)', missing;
  END IF;

  RAISE NOTICE 'tenant_isolation_rls_check: org_row_select present on core tables.';
END $$;
