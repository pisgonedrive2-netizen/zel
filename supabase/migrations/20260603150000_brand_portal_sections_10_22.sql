-- Marka portal §10–§22 — CRM genişletme, bordro run, fatura satırları

ALTER TABLE public.crm_deals
  ADD COLUMN IF NOT EXISTS expected_monthly_ftd integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_model text
    CHECK (commission_model IS NULL OR commission_model IN ('cpa', 'revshare', 'hybrid', 'flat'));

CREATE TABLE IF NOT EXISTS public.brand_payroll_runs (
  id text PRIMARY KEY,
  brand_id text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  month text NOT NULL CHECK (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'paid')),
  approved_by text REFERENCES public.app_users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, month)
);

CREATE TABLE IF NOT EXISTS public.brand_invoice_lines (
  id text PRIMARY KEY,
  brand_id text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  invoice_id text NOT NULL REFERENCES public.brand_invoices(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  quantity numeric(10, 2) NOT NULL DEFAULT 1,
  unit_price numeric(14, 2) NOT NULL DEFAULT 0,
  ref_type text,
  ref_id text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brand_invoice_lines_invoice ON public.brand_invoice_lines (invoice_id);

DO $tr$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS tr_brand_payroll_runs_updated ON public.brand_payroll_runs';
  EXECUTE 'CREATE TRIGGER tr_brand_payroll_runs_updated BEFORE UPDATE ON public.brand_payroll_runs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
END $tr$;

DO $rls$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['brand_payroll_runs', 'brand_invoice_lines'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS service_role_all_%s ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY service_role_all_%s ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      t, t
    );
  END LOOP;
END $rls$;
