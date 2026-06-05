-- Marka personeli: sabit maaş bileşenleri (baz / kira / yemek) kalem bazlı ödeme durumu
CREATE TABLE IF NOT EXISTS public.brand_payroll_component_payments (
  brand_id    text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  staff_id    text NOT NULL REFERENCES public.brand_staff(id) ON DELETE CASCADE,
  month       text NOT NULL CHECK (month ~ '^[0-9]{4}-[0-9]{2}$'),
  component   text NOT NULL CHECK (component IN ('base_salary', 'rent', 'meal')),
  paid        boolean NOT NULL DEFAULT false,
  paid_date   text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (brand_id, staff_id, month, component)
);
CREATE INDEX IF NOT EXISTS idx_brand_payroll_comp_pay_staff_month
  ON public.brand_payroll_component_payments (staff_id, month);
ALTER TABLE public.brand_payroll_component_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_brand_payroll_comp" ON public.brand_payroll_component_payments;
CREATE POLICY "service_role_all_brand_payroll_comp" ON public.brand_payroll_component_payments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
