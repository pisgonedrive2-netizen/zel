-- PIN / kullanıcı şeması + bildirim enum tamamlama + app_users FK
-- Şifre (PIN) değişikliği: pin_hash güncellenir; pin_updated_at izlenir.

-- ── 1) PIN güncelleme zamanı ────────────────────────────────────────────────
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS pin_updated_at timestamptz;

COMMENT ON COLUMN public.app_users.pin_updated_at IS
  'pin_hash son değiştirildiğinde (admin panel veya API).';

-- Kullanıcı adı her zaman küçük harf (login ile uyumlu)
UPDATE public.app_users
SET username = lower(trim(username))
WHERE username IS DISTINCT FROM lower(trim(username));

DO $$ BEGIN
  ALTER TABLE public.app_users
    ADD CONSTRAINT app_users_username_lowercase
    CHECK (username = lower(trim(username)));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Marka hesabı → brands FK (varsa geçersiz brand_id engellenir)
DO $$ BEGIN
  ALTER TABLE public.app_users
    ADD CONSTRAINT app_users_brand_id_fkey
    FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_app_users_brand
  ON public.app_users (brand_id)
  WHERE brand_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_app_users_username_active
  ON public.app_users (username)
  WHERE active = true;

-- ── 2) Bildirim tipleri (şifre sıfırlama / kayıt talebi / marka hatırlatma) ─
DO $$ BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'brand_payment_reminder';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'password_reset_request';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'account_registration_request';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'expense_paid';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_ref_id
  ON public.app_notifications (ref_id)
  WHERE ref_id IS NOT NULL;

-- ── 3) brand_monthly_stats — tablo önceden kısıtsız oluşturulduysa tamamla ─
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'brand_monthly_stats'
  ) THEN
    -- updated_by FK (sütun yoksa ekle)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'brand_monthly_stats'
        AND column_name = 'updated_by'
    ) THEN
      ALTER TABLE public.brand_monthly_stats
        ADD COLUMN updated_by text REFERENCES public.app_users(id) ON DELETE SET NULL;
    END IF;

    -- Ay formatı
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'brand_monthly_stats_month_format'
    ) THEN
      ALTER TABLE public.brand_monthly_stats
        ADD CONSTRAINT brand_monthly_stats_month_format
        CHECK (month ~ '^\d{4}-(0[1-9]|1[0-2])$');
    END IF;

    -- Para birimi
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'brand_monthly_stats_currency_check'
    ) THEN
      ALTER TABLE public.brand_monthly_stats
        ADD CONSTRAINT brand_monthly_stats_currency_check
        CHECK (currency IN ('TRY', 'USD', 'EUR'));
    END IF;

    -- FTD <= yatırım yapan üye
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'brand_monthly_stats_ftd_lte_depositing'
    ) THEN
      ALTER TABLE public.brand_monthly_stats
        ADD CONSTRAINT brand_monthly_stats_ftd_lte_depositing
        CHECK (first_time_depositors <= depositing_members);
    END IF;
  END IF;
END $$;
