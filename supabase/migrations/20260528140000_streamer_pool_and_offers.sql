-- Foxstream — Faz G: Yayıncı Havuzu + Teklif Sistemi
--
-- Üç yeni tablo:
--   * streamer_pool_profiles — yayıncının havuzda görünen halka açık profili (1:1 employee)
--   * brand_offers           — marka↔yayıncı arasındaki teklif başlığı (kim başlattı, durum)
--   * brand_offer_messages   — teklif sohbeti + karşı teklif fiyatları
--
-- Tüm tablolar RLS açık; brand/streamer/admin guard'ları uygulama tarafında (deal-access.ts).
-- Uygulama service-role anahtarı ile yazar.
--
-- Trigger: set_updated_at (initial_schema.sql) tüm yeni tablolara bağlanır.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. streamer_pool_profiles — yayıncı havuz profili
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.streamer_pool_profiles (
  id              text PRIMARY KEY,
  employee_id     text NOT NULL UNIQUE REFERENCES public.employees(id) ON DELETE CASCADE,
  display_name    text NOT NULL,
  headline        text NOT NULL DEFAULT '',
  bio             text NOT NULL DEFAULT '',
  categories      text[] NOT NULL DEFAULT '{}',
  languages       text[] NOT NULL DEFAULT '{tr}',
  countries       text[] NOT NULL DEFAULT '{TR}',
  rate_min_usd    numeric(12, 2),
  rate_max_usd    numeric(12, 2),
  rate_currency   text NOT NULL DEFAULT 'USD',
  followers_total integer NOT NULL DEFAULT 0,
  avg_views       integer NOT NULL DEFAULT 0,
  avatar_url      text,
  cover_url       text,
  status          text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'published', 'paused', 'closed')),
  visibility      text NOT NULL DEFAULT 'public'
                  CHECK (visibility IN ('public', 'brand_only', 'invite_only')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_streamer_pool_profiles_status
  ON public.streamer_pool_profiles (status);

CREATE INDEX IF NOT EXISTS idx_streamer_pool_profiles_visibility_status
  ON public.streamer_pool_profiles (visibility, status);

COMMENT ON TABLE public.streamer_pool_profiles IS
  'Faz G: yayıncının halka açık havuz profili (bio, kategori, ücret aralığı). 1:1 employees.id.';

DROP TRIGGER IF EXISTS tr_streamer_pool_profiles_updated ON public.streamer_pool_profiles;
CREATE TRIGGER tr_streamer_pool_profiles_updated
  BEFORE UPDATE ON public.streamer_pool_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.streamer_pool_profiles ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. brand_offers — marka ↔ yayıncı teklif başlığı
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.brand_offers (
  id              text PRIMARY KEY,
  brand_id        text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  employee_id     text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  initiator       text NOT NULL DEFAULT 'brand'
                  CHECK (initiator IN ('brand', 'streamer')),
  title           text NOT NULL,
  description     text NOT NULL DEFAULT '',
  offer_type      text NOT NULL DEFAULT 'campaign'
                  CHECK (offer_type IN ('campaign', 'single_post', 'long_term', 'affiliate')),
  budget_usd      numeric(12, 2),
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'negotiating', 'accepted', 'rejected', 'withdrawn', 'expired')),
  deliverables    jsonb NOT NULL DEFAULT '[]'::jsonb,
  start_date      date,
  end_date        date,
  notes           text NOT NULL DEFAULT '',
  expires_at      timestamptz,
  created_by      text REFERENCES public.app_users(id) ON DELETE SET NULL,
  responded_by    text REFERENCES public.app_users(id) ON DELETE SET NULL,
  responded_at    timestamptz,
  created_deal_id text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_offers_brand_status
  ON public.brand_offers (brand_id, status);

CREATE INDEX IF NOT EXISTS idx_brand_offers_employee_status
  ON public.brand_offers (employee_id, status);

CREATE INDEX IF NOT EXISTS idx_brand_offers_created_at
  ON public.brand_offers (created_at DESC);

COMMENT ON TABLE public.brand_offers IS
  'Faz G: marka↔yayıncı teklif başlığı. Initiator/status/deliverables. Kabul edilince brand_deals satırı oluşturulur.';

DROP TRIGGER IF EXISTS tr_brand_offers_updated ON public.brand_offers;
CREATE TRIGGER tr_brand_offers_updated
  BEFORE UPDATE ON public.brand_offers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.brand_offers ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. brand_offer_messages — teklif sohbeti + counter offers
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.brand_offer_messages (
  id                 text PRIMARY KEY,
  offer_id           text NOT NULL REFERENCES public.brand_offers(id) ON DELETE CASCADE,
  author_id          text NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  author_role        text NOT NULL CHECK (author_role IN ('brand', 'streamer', 'admin')),
  body               text NOT NULL,
  counter_budget_usd numeric(12, 2),
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_offer_messages_offer_created
  ON public.brand_offer_messages (offer_id, created_at);

COMMENT ON TABLE public.brand_offer_messages IS
  'Faz G: brand_offers sohbet kayıtları. counter_budget_usd dolu olan satır = karşı teklif.';

ALTER TABLE public.brand_offer_messages ENABLE ROW LEVEL SECURITY;
