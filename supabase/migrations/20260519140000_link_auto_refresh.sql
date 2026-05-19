-- =============================================================================
-- LINK OTOMATİK YENİLEME ALTYAPISI
-- =============================================================================
-- brand_links tablosuna otomatik yenileme alanları eklenir.
-- api_quota_usage: RapidAPI Basic planlarının aylık kotasını izler.
-- api_refresh_runs: cron çalışmalarının özetini saklar (debug/observability).
--
-- Basic plan limitleri (referans):
--   • YouTube (youtube138)            : 100 req/ay
--   • Instagram (fast-reliable)       : 100 req/ay
--   • TikTok (tiktok-scraper7)        : 300 req/ay (Scraping API)
--
-- =============================================================================

-- 1) brand_links: takip metadata kolonları ---------------------------------
ALTER TABLE public.brand_links
  ADD COLUMN IF NOT EXISTS external_ref       text,
  ADD COLUMN IF NOT EXISTS last_checked_at    timestamptz,
  ADD COLUMN IF NOT EXISTS last_likes         bigint,
  ADD COLUMN IF NOT EXISTS last_comments      bigint,
  ADD COLUMN IF NOT EXISTS last_shares        bigint,
  ADD COLUMN IF NOT EXISTS last_check_error   text,
  ADD COLUMN IF NOT EXISTS check_count        integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_count        integer NOT NULL DEFAULT 0;

-- Oldest-first round-robin için indeks
CREATE INDEX IF NOT EXISTS brand_links_auto_track_check_idx
  ON public.brand_links (platform, status, auto_track, last_checked_at NULLS FIRST)
  WHERE auto_track = true AND status = 'active';

-- 2) api_quota_usage --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.api_quota_usage (
  id              text PRIMARY KEY,
  platform        text NOT NULL,         -- 'youtube' | 'tiktok' | 'instagram'
  month           text NOT NULL,         -- 'YYYY-MM'
  requests_used   integer NOT NULL DEFAULT 0,
  monthly_limit   integer NOT NULL,
  last_request_at timestamptz,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, month)
);
CREATE INDEX IF NOT EXISTS api_quota_usage_platform_month_idx
  ON public.api_quota_usage (platform, month);

DROP TRIGGER IF EXISTS tr_api_quota_usage_updated ON public.api_quota_usage;
CREATE TRIGGER tr_api_quota_usage_updated
  BEFORE UPDATE ON public.api_quota_usage
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) api_refresh_runs -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.api_refresh_runs (
  id                text PRIMARY KEY,
  started_at        timestamptz NOT NULL DEFAULT now(),
  finished_at       timestamptz,
  platform          text NOT NULL,
  links_attempted   integer NOT NULL DEFAULT 0,
  links_succeeded   integer NOT NULL DEFAULT 0,
  links_failed      integer NOT NULL DEFAULT 0,
  quota_used        integer NOT NULL DEFAULT 0,
  triggered_by      text NOT NULL DEFAULT 'cron',  -- 'cron' | 'manual'
  triggered_by_user text,
  error_summary     text NOT NULL DEFAULT '',
  notes             text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS api_refresh_runs_started_idx
  ON public.api_refresh_runs (started_at DESC);
CREATE INDEX IF NOT EXISTS api_refresh_runs_platform_idx
  ON public.api_refresh_runs (platform, started_at DESC);

-- 4) link_snapshots: çoğu durumda günde 1 satır olur; yine de UNIQUE eklemiyoruz
-- çünkü manuel ve otomatik snapshot'lar aynı gün çakışabilir; ayrı saklanmaları
-- delta hesabını kolaylaştırır.

-- 5) RLS ---------------------------------------------------------------------
-- Mevcut tablolardakiyle aynı pattern: RLS açık, policy yok; tüm erişim
-- service-role üzerinden API katmanından.
ALTER TABLE public.api_quota_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_refresh_runs ENABLE ROW LEVEL SECURITY;
