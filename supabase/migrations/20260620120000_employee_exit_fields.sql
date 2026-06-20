-- Personel iş çıkışı alanları
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS payroll_end_month text,
  ADD COLUMN IF NOT EXISTS exit_date date,
  ADD COLUMN IF NOT EXISTS exit_reason text;

COMMENT ON COLUMN public.employees.payroll_end_month IS 'Son bordro ayı (YYYY-MM, dahil)';
COMMENT ON COLUMN public.employees.exit_date IS 'İşten ayrılış tarihi';
COMMENT ON COLUMN public.employees.exit_reason IS 'resignation | termination | contract_end | other';
