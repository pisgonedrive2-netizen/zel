-- Foxstream — Faz H: Aktif Anlaşma + İçerik Post Takibi
--
-- İki yeni tablo:
--   * brand_deals — kabul edilen teklif sonrası oluşan anlaşma kaydı (yaşam döngüsü)
--   * brand_posts — yayıncının attığı içerik URL'leri (deal bağımlı veya bağımsız)
--
-- Denormalize: brand_deals.posts_count ve total_views, brand_posts insert/update/delete
-- üzerinde idempotent fonksiyon (`recompute_deal_post_metrics`) ile yeniden hesaplanır.
-- Trigger SECURITY DEFINER + search_path=public olduğundan herhangi bir rol post yazsa da
-- deal toplamı tutarlı kalır.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. brand_deals — aktif anlaşma kaydı
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.brand_deals (
  id              text PRIMARY KEY,
  brand_id        text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  employee_id     text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  origin_offer_id text REFERENCES public.brand_offers(id) ON DELETE SET NULL,
  title           text NOT NULL,
  deal_type       text NOT NULL DEFAULT 'campaign'
                  CHECK (deal_type IN ('campaign', 'single_post', 'long_term', 'affiliate')),
  status          text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'completed', 'cancelled', 'disputed')),
  budget_usd      numeric(12, 2) NOT NULL DEFAULT 0,
  paid_usd        numeric(12, 2) NOT NULL DEFAULT 0,
  start_date      date,
  end_date        date,
  deliverables    jsonb NOT NULL DEFAULT '[]'::jsonb,
  posts_count     integer NOT NULL DEFAULT 0,
  total_views     bigint NOT NULL DEFAULT 0,
  notes           text NOT NULL DEFAULT '',
  contract_url    text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_deals_brand_status
  ON public.brand_deals (brand_id, status);

CREATE INDEX IF NOT EXISTS idx_brand_deals_employee_status
  ON public.brand_deals (employee_id, status);

CREATE INDEX IF NOT EXISTS idx_brand_deals_origin_offer
  ON public.brand_deals (origin_offer_id)
  WHERE origin_offer_id IS NOT NULL;

COMMENT ON TABLE public.brand_deals IS
  'Faz H: kabul edilmiş teklif sonrası anlaşma yaşam döngüsü. posts_count/total_views denormalize, trigger ile güncellenir.';

DROP TRIGGER IF EXISTS tr_brand_deals_updated ON public.brand_deals;
CREATE TRIGGER tr_brand_deals_updated
  BEFORE UPDATE ON public.brand_deals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.brand_deals ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. brand_posts — yayıncı içerik URL'leri
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.brand_posts (
  id             text PRIMARY KEY,
  brand_id       text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  employee_id    text REFERENCES public.employees(id) ON DELETE SET NULL,
  deal_id        text REFERENCES public.brand_deals(id) ON DELETE SET NULL,
  platform       text NOT NULL
                 CHECK (platform IN ('instagram', 'tiktok', 'youtube', 'kick', 'twitter', 'telegram', 'other')),
  post_type      text NOT NULL DEFAULT 'post'
                 CHECK (post_type IN ('post', 'reel', 'story', 'vlog', 'stream', 'vod', 'tweet', 'other')),
  url            text NOT NULL,
  caption        text NOT NULL DEFAULT '',
  posted_at      timestamptz,
  screenshot_url text,
  views          bigint  NOT NULL DEFAULT 0,
  likes          integer NOT NULL DEFAULT 0,
  comments       integer NOT NULL DEFAULT 0,
  status         text NOT NULL DEFAULT 'live'
                 CHECK (status IN ('draft', 'live', 'removed', 'expired')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, url)
);

CREATE INDEX IF NOT EXISTS idx_brand_posts_brand_status
  ON public.brand_posts (brand_id, status);

CREATE INDEX IF NOT EXISTS idx_brand_posts_deal
  ON public.brand_posts (deal_id)
  WHERE deal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_brand_posts_employee_posted
  ON public.brand_posts (employee_id, posted_at DESC)
  WHERE employee_id IS NOT NULL;

COMMENT ON TABLE public.brand_posts IS
  'Faz H: yayıncı içerik URL takibi. UNIQUE (brand_id, url). views/likes manuel veya refresh-metric ile güncellenir.';

DROP TRIGGER IF EXISTS tr_brand_posts_updated ON public.brand_posts;
CREATE TRIGGER tr_brand_posts_updated
  BEFORE UPDATE ON public.brand_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.brand_posts ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Denormalize trigger — brand_deals.posts_count + total_views
-- ─────────────────────────────────────────────────────────────────────────────
-- `recompute_deal_post_metrics` herhangi bir deal_id'yi yeniden hesaplar
-- (status='live'|'expired' içerikleri kabul eder, taslak/removed sayılmaz).
-- SECURITY DEFINER + search_path=public: post yazan rolün yetkisinden bağımsız çalışır.
CREATE OR REPLACE FUNCTION public.recompute_deal_post_metrics(p_deal_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_deal_id IS NULL THEN
    RETURN;
  END IF;
  UPDATE public.brand_deals d
  SET
    posts_count = COALESCE(agg.cnt, 0),
    total_views = COALESCE(agg.views, 0),
    updated_at = now()
  FROM (
    SELECT
      COUNT(*)::int                 AS cnt,
      COALESCE(SUM(views), 0)::bigint AS views
    FROM public.brand_posts
    WHERE deal_id = p_deal_id
      AND status IN ('live', 'expired')
  ) AS agg
  WHERE d.id = p_deal_id;
END;
$$;

COMMENT ON FUNCTION public.recompute_deal_post_metrics(text) IS
  'Faz H: brand_deals.posts_count ve total_views''i brand_posts üzerinden idempotent yeniden hesaplar.';

CREATE OR REPLACE FUNCTION public.tr_brand_posts_recompute_metrics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.recompute_deal_post_metrics(NEW.deal_id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_deal_post_metrics(OLD.deal_id);
  ELSE
    -- UPDATE: deal_id, views veya status değiştiyse ilgili deal(lar)ı tazele.
    IF NEW.deal_id IS DISTINCT FROM OLD.deal_id THEN
      PERFORM public.recompute_deal_post_metrics(OLD.deal_id);
      PERFORM public.recompute_deal_post_metrics(NEW.deal_id);
    ELSIF NEW.views IS DISTINCT FROM OLD.views OR NEW.status IS DISTINCT FROM OLD.status THEN
      PERFORM public.recompute_deal_post_metrics(NEW.deal_id);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.tr_brand_posts_recompute_metrics() IS
  'Faz H: brand_posts insert/update/delete sonrası brand_deals toplamlarını tazeler.';

DROP TRIGGER IF EXISTS tr_brand_posts_metrics_aiud ON public.brand_posts;
CREATE TRIGGER tr_brand_posts_metrics_aiud
  AFTER INSERT OR UPDATE OR DELETE ON public.brand_posts
  FOR EACH ROW EXECUTE FUNCTION public.tr_brand_posts_recompute_metrics();
