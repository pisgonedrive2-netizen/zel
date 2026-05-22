-- İçerik harcaması ödeme yolu: kasa veya bordro (maaş masrafı)
-- Mevcut kayıtlar korunur; yeni alanlar NULL / varsayılan.

ALTER TABLE public.content_expenses
  ADD COLUMN IF NOT EXISTS settlement_mode text
    CHECK (settlement_mode IS NULL OR settlement_mode IN ('kasa', 'payroll')),
  ADD COLUMN IF NOT EXISTS salary_extra_id text
    REFERENCES public.salary_extras(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_content_expenses_settlement
  ON public.content_expenses (settlement_mode)
  WHERE settlement_mode IS NOT NULL;

ALTER TABLE public.salary_extras
  ADD COLUMN IF NOT EXISTS content_expense_id text
    REFERENCES public.content_expenses(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_salary_extras_content_expense
  ON public.salary_extras (content_expense_id)
  WHERE content_expense_id IS NOT NULL;
