-- Ayarlanabilir aylık avans kesintisi planı (başlangıç ayı + tutar).
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS advance_monthly_cut numeric(14,2),
  ADD COLUMN IF NOT EXISTS advance_repay_start_month text;

COMMENT ON COLUMN public.employees.advance_monthly_cut IS
  'Aylık avans kesinti tutarı (USD). NULL/0 = otomatik kesinti yok';
COMMENT ON COLUMN public.employees.advance_repay_start_month IS
  'Avans kesintisinin başladığı ilk ay (YYYY-MM). Bu aydan önce kesinti üretilmez.';
