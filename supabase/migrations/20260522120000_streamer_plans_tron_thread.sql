-- Haftalık plan: hangi yayıncı hesabından
ALTER TABLE public.weekly_plans
  ADD COLUMN IF NOT EXISTS streamer_account_id text
  REFERENCES public.streamer_accounts(id) ON DELETE SET NULL;

-- Reel: platform yayın tarihi (API'den)
ALTER TABLE public.week_brand_reels
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

-- Harcama inceleme diyaloğu
ALTER TABLE public.content_expenses
  ADD COLUMN IF NOT EXISTS review_thread jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Kasa: TRON (TRC20) adres takibi
ALTER TABLE public.kasas
  ADD COLUMN IF NOT EXISTS tron_address text,
  ADD COLUMN IF NOT EXISTS tron_sync_from date;

ALTER TABLE public.kasa_transactions
  ADD COLUMN IF NOT EXISTS tron_tx_id text,
  ADD COLUMN IF NOT EXISTS auto_imported boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_kasa_tx_tron_unique
  ON public.kasa_transactions (tron_tx_id)
  WHERE tron_tx_id IS NOT NULL;
