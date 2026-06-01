-- Foxstream — Faz 6: Marka Bordro (Payroll-lite) & Departmanlar
--
-- Markaların kendi personeli için lite bordro yönetimi: departman organizasyonu,
-- maaş bileşenleri (baz maaş / kira desteği / yemek yardımı) ve aylık bordro
-- kalemleri (avans, prim, kesinti, kira, yemek, diğer).
--
-- Erişim: uygulama yalnızca service_role ile yazar/okur (diğer brand tablolarıyla
-- aynı desen). RLS açık + yalnızca service_role politikası tanımlı.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Departmanlar
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.brand_departments (
  id            text PRIMARY KEY,
  brand_id      text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  name          text NOT NULL,
  description   text NOT NULL DEFAULT '',
  lead_staff_id text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brand_departments_brand ON public.brand_departments (brand_id);
DROP TRIGGER IF EXISTS tr_brand_departments_updated ON public.brand_departments;
CREATE TRIGGER tr_brand_departments_updated BEFORE UPDATE ON public.brand_departments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.brand_departments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_brand_departments" ON public.brand_departments;
CREATE POLICY "service_role_all_brand_departments" ON public.brand_departments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) brand_staff: departman ataması + maaş bileşenleri (geriye dönük uyumlu)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.brand_staff
  ADD COLUMN IF NOT EXISTS department_id  text REFERENCES public.brand_departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS base_salary    numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rent_support   numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meal_allowance numeric(14,2) NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_brand_staff_department ON public.brand_staff (department_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Bordro kalemleri (aylık)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.brand_payroll_items (
  id          text PRIMARY KEY,
  brand_id    text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  staff_id    text NOT NULL REFERENCES public.brand_staff(id) ON DELETE CASCADE,
  month       text NOT NULL CHECK (month ~ '^[0-9]{4}-[0-9]{2}$'),
  type        text NOT NULL DEFAULT 'other' CHECK (type IN ('advance','bonus','deduction','rent','meal','other')),
  amount      numeric(14,2) NOT NULL DEFAULT 0,
  currency    text NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD','EUR','TRY')),
  description text NOT NULL DEFAULT '',
  paid        boolean NOT NULL DEFAULT false,
  paid_date   text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brand_payroll_items_brand_month ON public.brand_payroll_items (brand_id, month);
CREATE INDEX IF NOT EXISTS idx_brand_payroll_items_staff ON public.brand_payroll_items (staff_id);
DROP TRIGGER IF EXISTS tr_brand_payroll_items_updated ON public.brand_payroll_items;
CREATE TRIGGER tr_brand_payroll_items_updated BEFORE UPDATE ON public.brand_payroll_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.brand_payroll_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_brand_payroll_items" ON public.brand_payroll_items;
CREATE POLICY "service_role_all_brand_payroll_items" ON public.brand_payroll_items
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- PostgREST şema önbelleğini yenile.
-- ─────────────────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
