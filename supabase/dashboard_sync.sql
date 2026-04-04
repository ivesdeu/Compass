-- Dashboard full sync: run in Supabase SQL Editor (adjust if objects already exist).
-- Requires existing `transactions` and `clients` tables with `user_id` and RLS you already use.

-- ---- Transactions: extra columns for income links and rich expense/income fields ----
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS client_id uuid;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS other_label text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS other_type text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Optional: clients table retainer flag (if not already added)
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS is_retainer boolean DEFAULT false;

-- ---- Projects ----
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  client_id uuid,
  name text,
  status text,
  type text,
  start_date date,
  due_date date,
  value numeric DEFAULT 0,
  description text,
  notes text,
  satisfaction int,
  archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  case_study_published boolean DEFAULT false,
  case_study_challenge text,
  case_study_strategy jsonb DEFAULT '[]'::jsonb,
  case_study_results jsonb DEFAULT '[]'::jsonb,
  case_study_category text
);
CREATE INDEX IF NOT EXISTS projects_user_id_idx ON public.projects (user_id);

-- ---- Invoices (links to income transaction id) ----
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  income_tx_id uuid NOT NULL,
  number text,
  date_issued date,
  due_date date,
  amount numeric DEFAULT 0,
  status text DEFAULT 'sent',
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invoices_user_id_idx ON public.invoices (user_id);
CREATE INDEX IF NOT EXISTS invoices_income_tx_id_idx ON public.invoices (income_tx_id);

-- ---- Marketing campaigns ----
CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text,
  channel text,
  start_date date,
  notes text,
  pipeline_value numeric DEFAULT 0,
  status text DEFAULT 'pipeline',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS campaigns_user_id_idx ON public.campaigns (user_id);

-- ---- Per-user JSON settings (e.g. custom project status labels) ----
CREATE TABLE IF NOT EXISTS public.app_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  project_statuses jsonb DEFAULT '[]'::jsonb,
  updated_at timestamptz DEFAULT now()
);

-- ---- RLS ----
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projects_select_own" ON public.projects;
DROP POLICY IF EXISTS "projects_insert_own" ON public.projects;
DROP POLICY IF EXISTS "projects_update_own" ON public.projects;
DROP POLICY IF EXISTS "projects_delete_own" ON public.projects;
CREATE POLICY "projects_select_own" ON public.projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "projects_insert_own" ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "projects_update_own" ON public.projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "projects_delete_own" ON public.projects FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "invoices_select_own" ON public.invoices;
DROP POLICY IF EXISTS "invoices_insert_own" ON public.invoices;
DROP POLICY IF EXISTS "invoices_update_own" ON public.invoices;
DROP POLICY IF EXISTS "invoices_delete_own" ON public.invoices;
CREATE POLICY "invoices_select_own" ON public.invoices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "invoices_insert_own" ON public.invoices FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "invoices_update_own" ON public.invoices FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "invoices_delete_own" ON public.invoices FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "campaigns_select_own" ON public.campaigns;
DROP POLICY IF EXISTS "campaigns_insert_own" ON public.campaigns;
DROP POLICY IF EXISTS "campaigns_update_own" ON public.campaigns;
DROP POLICY IF EXISTS "campaigns_delete_own" ON public.campaigns;
CREATE POLICY "campaigns_select_own" ON public.campaigns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "campaigns_insert_own" ON public.campaigns FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "campaigns_update_own" ON public.campaigns FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "campaigns_delete_own" ON public.campaigns FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "app_settings_select_own" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_insert_own" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_update_own" ON public.app_settings;
CREATE POLICY "app_settings_select_own" ON public.app_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "app_settings_insert_own" ON public.app_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "app_settings_update_own" ON public.app_settings FOR UPDATE USING (auth.uid() = user_id);

-- Ensure transactions policies allow new columns (usually column-level is not restricted).
-- If `transactions` has no UPDATE for client_id/project_id, add policies as needed for your schema.

-- Case study fields (idempotent if already present — safe for existing `projects` rows)
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS case_study_published boolean DEFAULT false;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS case_study_challenge text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS case_study_strategy jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS case_study_results jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS case_study_category text;
