-- ─────────────────────────────────────────────────────────────────────────────
-- Çoklu kasa desteği + maaş ↔ kasa entegrasyonu
-- ─────────────────────────────────────────────────────────────────────────────
-- Bu migrasyon güvenli şekilde uygulanabilir:
--   1) `kasas` tablosu (kasa hesapları) oluşturulur.
--   2) Varsayılan "Genel Kasa" eklenir.
--   3) `kasa_transactions.kasa_id` nullable eklenir, mevcut hareketler
--      "Genel Kasa"ya backfill edilir, sonra NOT NULL + FK uygulanır.
--   4) `payment_statuses.kasa_tx_id` opsiyonel referans olarak eklenir
--      (maaş ödendi ↔ kasa hareketi bağlantısı).
--   5) `calc_kasa_balance` opsiyonel kasa filtresiyle güncellenir.
-- Mevcut hiçbir veri kaybolmaz veya değişmez.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Kasa hesapları tablosu
CREATE TABLE IF NOT EXISTS public.kasas (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  kind        text NOT NULL DEFAULT 'general',  -- 'general' | 'usdt' | 'bank' | 'cash' | 'other'
  currency    text NOT NULL DEFAULT 'USD',
  is_default  boolean NOT NULL DEFAULT false,
  archived    boolean NOT NULL DEFAULT false,
  order_index integer NOT NULL DEFAULT 0,
  notes       text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kasas ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_kasas_archived ON public.kasas(archived);
CREATE INDEX IF NOT EXISTS idx_kasas_order    ON public.kasas(order_index);

DROP TRIGGER IF EXISTS trg_kasas_updated_at ON public.kasas;
CREATE TRIGGER trg_kasas_updated_at
BEFORE UPDATE ON public.kasas
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Varsayılan "Genel Kasa" — id sabitlenir; mevcut hareketler buraya bağlanacak.
INSERT INTO public.kasas (id, name, kind, currency, is_default, order_index, notes)
VALUES (
  'kasa-genel',
  'Genel Kasa',
  'general',
  'USD',
  true,
  0,
  'Varsayılan kasa. Migrasyon öncesi tüm kasa hareketleri buraya bağlandı.'
)
ON CONFLICT (id) DO NOTHING;

-- 3) kasa_transactions.kasa_id (nullable → backfill → NOT NULL + FK)
ALTER TABLE public.kasa_transactions
  ADD COLUMN IF NOT EXISTS kasa_id text;

UPDATE public.kasa_transactions
SET kasa_id = 'kasa-genel'
WHERE kasa_id IS NULL;

ALTER TABLE public.kasa_transactions
  ALTER COLUMN kasa_id SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE public.kasa_transactions
    ADD CONSTRAINT kasa_transactions_kasa_id_fkey
    FOREIGN KEY (kasa_id) REFERENCES public.kasas(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_kasa_transactions_kasa_id
  ON public.kasa_transactions(kasa_id);

-- 4) payment_statuses.kasa_tx_id — maaş ödenince hangi kasa hareketinde
--    görüldüğünü tutar. "Geri al" akışında kasa hareketi silinir.
ALTER TABLE public.payment_statuses
  ADD COLUMN IF NOT EXISTS kasa_tx_id text;

DO $$ BEGIN
  ALTER TABLE public.payment_statuses
    ADD CONSTRAINT payment_statuses_kasa_tx_id_fkey
    FOREIGN KEY (kasa_tx_id) REFERENCES public.kasa_transactions(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_payment_statuses_kasa_tx_id
  ON public.payment_statuses(kasa_tx_id);

-- 5) calc_kasa_balance — opsiyonel kasa filtresi; search_path sabit.
-- Eski tek-argümanlı imza (timestamptz) varsa düşürülür; aşağıdaki iki-argümanlı
-- versiyon ile değiştirilir.
DROP FUNCTION IF EXISTS public.calc_kasa_balance(timestamptz);

CREATE OR REPLACE FUNCTION public.calc_kasa_balance(
  p_as_of   timestamptz DEFAULT NULL,
  p_kasa_id text        DEFAULT NULL
)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(SUM(
    CASE
      WHEN direction = 'in' THEN amount_usd
      ELSE -(amount_usd + fee_usd)
    END
  ), 0)
  FROM public.kasa_transactions
  WHERE (p_as_of   IS NULL OR date    <= p_as_of)
    AND (p_kasa_id IS NULL OR kasa_id  = p_kasa_id);
$$;
