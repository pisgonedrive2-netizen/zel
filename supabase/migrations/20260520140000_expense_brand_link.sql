-- Genel giderlere opsiyonel marka bağlantısı (marka panelinde gösterim için)

ALTER TABLE public.expense_entries
  ADD COLUMN IF NOT EXISTS brand_id text REFERENCES public.brands(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expense_entries_brand_id
  ON public.expense_entries(brand_id)
  WHERE brand_id IS NOT NULL;

COMMENT ON COLUMN public.expense_entries.brand_id IS
  'Opsiyonel: gider belirli bir markaya atanmışsa marka panelinde listelenir.';
