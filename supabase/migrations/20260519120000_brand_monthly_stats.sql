-- Marka bazlı aylık operasyon metrikleri (kayıt, yatırım yapan üye, tutarlar).
-- Uygulama: /izlenme (admin giriş) · /marka/izlenmeler (salt okunur)

CREATE TABLE IF NOT EXISTS public.brand_monthly_stats (
  id                    text PRIMARY KEY,
  brand_id              text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  month                 text NOT NULL,
  new_registrations     integer NOT NULL DEFAULT 0,
  depositing_members    integer NOT NULL DEFAULT 0,
  first_time_depositors integer NOT NULL DEFAULT 0,
  deposit_count         integer NOT NULL DEFAULT 0,
  deposit_amount        numeric(16, 2) NOT NULL DEFAULT 0,
  withdrawal_amount     numeric(16, 2) NOT NULL DEFAULT 0,
  currency              text NOT NULL DEFAULT 'TRY',
  notes                 text NOT NULL DEFAULT '',
  updated_by            text REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT brand_monthly_stats_month_format
    CHECK (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  CONSTRAINT brand_monthly_stats_currency_check
    CHECK (currency IN ('TRY', 'USD', 'EUR')),
  CONSTRAINT brand_monthly_stats_new_registrations_nonneg
    CHECK (new_registrations >= 0),
  CONSTRAINT brand_monthly_stats_depositing_members_nonneg
    CHECK (depositing_members >= 0),
  CONSTRAINT brand_monthly_stats_first_time_depositors_nonneg
    CHECK (first_time_depositors >= 0),
  CONSTRAINT brand_monthly_stats_deposit_count_nonneg
    CHECK (deposit_count >= 0),
  CONSTRAINT brand_monthly_stats_deposit_amount_nonneg
    CHECK (deposit_amount >= 0),
  CONSTRAINT brand_monthly_stats_withdrawal_amount_nonneg
    CHECK (withdrawal_amount >= 0),
  CONSTRAINT brand_monthly_stats_ftd_lte_depositing
    CHECK (first_time_depositors <= depositing_members),
  UNIQUE (brand_id, month)
);

CREATE INDEX IF NOT EXISTS idx_brand_monthly_stats_brand_month
  ON public.brand_monthly_stats (brand_id, month DESC);

CREATE INDEX IF NOT EXISTS idx_brand_monthly_stats_month
  ON public.brand_monthly_stats (month);

COMMENT ON TABLE public.brand_monthly_stats IS
  'Marka portalı ve admin izlenme: ay bazlı kayıt, yatırım yapan üye ve tutar özetleri.';

COMMENT ON COLUMN public.brand_monthly_stats.new_registrations IS 'Bu ay yeni kayıt olan üye sayısı';
COMMENT ON COLUMN public.brand_monthly_stats.depositing_members IS 'Bu ay en az bir yatırım yapan benzersiz üye';
COMMENT ON COLUMN public.brand_monthly_stats.first_time_depositors IS 'İlk kez yatırım yapan üye (FTD)';
COMMENT ON COLUMN public.brand_monthly_stats.deposit_count IS 'Yatırım işlem adedi';
COMMENT ON COLUMN public.brand_monthly_stats.deposit_amount IS 'Toplam yatırım tutarı';
COMMENT ON COLUMN public.brand_monthly_stats.withdrawal_amount IS 'Toplam çekim tutarı';
COMMENT ON COLUMN public.brand_monthly_stats.updated_by IS 'Son güncelleyen app_users.id (admin)';

DROP TRIGGER IF EXISTS tr_brand_monthly_stats_updated ON public.brand_monthly_stats;
CREATE TRIGGER tr_brand_monthly_stats_updated
  BEFORE UPDATE ON public.brand_monthly_stats
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.brand_monthly_stats ENABLE ROW LEVEL SECURITY;
