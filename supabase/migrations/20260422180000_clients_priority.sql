-- CRM customers table: optional priority label (inline edits + React island).
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS priority text;
