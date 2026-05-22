-- Planlanan ↔ Gider/Kasa bağlantıları ve performans indeksleri.
-- Mevcut veriler korunur; yeni bağlantı alanları opsiyoneldir.

ALTER TABLE public.expense_entries
  ADD COLUMN IF NOT EXISTS planned_item_id text
    REFERENCES public.planned_items(id) ON DELETE SET NULL;

ALTER TABLE public.kasa_transactions
  ADD COLUMN IF NOT EXISTS planned_item_id text
    REFERENCES public.planned_items(id) ON DELETE SET NULL;

ALTER TABLE public.planned_items
  ADD COLUMN IF NOT EXISTS kasa_tx_id text
    REFERENCES public.kasa_transactions(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'planned_items_expense_entry_id_fkey'
      AND conrelid = 'public.planned_items'::regclass
  ) THEN
    ALTER TABLE public.planned_items
      ADD CONSTRAINT planned_items_expense_entry_id_fkey
      FOREIGN KEY (expense_entry_id)
      REFERENCES public.expense_entries(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_expense_entries_date
  ON public.expense_entries(date);

CREATE INDEX IF NOT EXISTS idx_expense_entries_planned_item_id
  ON public.expense_entries(planned_item_id)
  WHERE planned_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kasa_transactions_planned_item_id
  ON public.kasa_transactions(planned_item_id)
  WHERE planned_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_planned_items_brand_id
  ON public.planned_items(brand_id)
  WHERE brand_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_planned_items_status
  ON public.planned_items(status);

CREATE INDEX IF NOT EXISTS idx_planned_items_target_date
  ON public.planned_items(target_date);

CREATE INDEX IF NOT EXISTS idx_planned_item_payments_item_month
  ON public.planned_item_payments(planned_item_id, month);
