-- ─────────────────────────────────────────────────────────────────────────────
-- Gider ↔ kasa hareketi bağlantısı
-- ─────────────────────────────────────────────────────────────────────────────
-- Genel giderler (expense_entries) ve içerik harcamaları (content_expenses)
-- kasada otomatik out yönlü bir hareket yaratabilsin. Bağlantı tek yönlü:
-- kasa hareketi silindiğinde alan nullify edilir (ON DELETE SET NULL).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.expense_entries
  ADD COLUMN IF NOT EXISTS kasa_tx_id text;

DO $$ BEGIN
  ALTER TABLE public.expense_entries
    ADD CONSTRAINT expense_entries_kasa_tx_id_fkey
    FOREIGN KEY (kasa_tx_id) REFERENCES public.kasa_transactions(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_expense_entries_kasa_tx_id
  ON public.expense_entries(kasa_tx_id);

ALTER TABLE public.content_expenses
  ADD COLUMN IF NOT EXISTS kasa_tx_id text;

DO $$ BEGIN
  ALTER TABLE public.content_expenses
    ADD CONSTRAINT content_expenses_kasa_tx_id_fkey
    FOREIGN KEY (kasa_tx_id) REFERENCES public.kasa_transactions(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_content_expenses_kasa_tx_id
  ON public.content_expenses(kasa_tx_id);
