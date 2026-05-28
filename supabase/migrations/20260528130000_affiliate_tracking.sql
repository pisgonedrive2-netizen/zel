-- Foxstream — Faz C: Affiliate Tracking MVP
--
-- Üç yeni tablo:
--   * affiliate_partners      — marka başına partner (yayıncı, harici, ajans, sosyal)
--   * affiliate_daily_stats   — partner × gün performans satırı (CSV import / manuel)
--   * affiliate_payouts       — partner ödemeleri (dönem bazlı)
--
-- Tüm tablolar RLS açık; brand-scoped policy ileride eklenecek (D fazı). Uygulama
-- şimdilik service-role anahtarı ile yazıyor.
--
-- Trigger: set_updated_at (initial_schema.sql) tüm yeni tablolara bağlanır.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. affiliate_partners
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.affiliate_partners (
  id               text PRIMARY KEY,
  brand_id         text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  name             text NOT NULL,
  external_ref     text,
  partner_type     text NOT NULL DEFAULT 'streamer'
                   CHECK (partner_type IN ('streamer', 'external', 'agency', 'social')),
  commission_model text NOT NULL DEFAULT 'cpa'
                   CHECK (commission_model IN ('cpa', 'revshare', 'hybrid', 'flat')),
  cpa_amount       numeric(12, 2) NOT NULL DEFAULT 0,
  revshare_pct     numeric(5, 2)  NOT NULL DEFAULT 0,
  currency         text NOT NULL DEFAULT 'USD'
                   CHECK (currency IN ('USD', 'EUR', 'TRY')),
  status           text NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'paused', 'closed')),
  employee_id      text REFERENCES public.employees(id) ON DELETE SET NULL,
  contact          text,
  notes            text NOT NULL DEFAULT '',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT affiliate_partners_cpa_nonneg CHECK (cpa_amount >= 0),
  CONSTRAINT affiliate_partners_revshare_range CHECK (revshare_pct >= 0 AND revshare_pct <= 100),
  UNIQUE (brand_id, external_ref)
);

CREATE INDEX IF NOT EXISTS idx_affiliate_partners_brand_status
  ON public.affiliate_partners (brand_id, status);

CREATE INDEX IF NOT EXISTS idx_affiliate_partners_brand_external_ref
  ON public.affiliate_partners (brand_id, external_ref);

CREATE INDEX IF NOT EXISTS idx_affiliate_partners_employee
  ON public.affiliate_partners (employee_id)
  WHERE employee_id IS NOT NULL;

COMMENT ON TABLE public.affiliate_partners IS
  'Faz C: marka başına affiliate / partner kaydı. external_ref operatör tarafındaki aff_id ile eşleşir.';

DROP TRIGGER IF EXISTS tr_affiliate_partners_updated ON public.affiliate_partners;
CREATE TRIGGER tr_affiliate_partners_updated
  BEFORE UPDATE ON public.affiliate_partners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.affiliate_partners ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. affiliate_daily_stats
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.affiliate_daily_stats (
  id                text PRIMARY KEY,
  partner_id        text NOT NULL REFERENCES public.affiliate_partners(id) ON DELETE CASCADE,
  brand_id          text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  stat_date         date NOT NULL,
  clicks            integer NOT NULL DEFAULT 0,
  registrations     integer NOT NULL DEFAULT 0,
  ftd_count         integer NOT NULL DEFAULT 0,
  ftd_amount        numeric(14, 2) NOT NULL DEFAULT 0,
  deposit_amount    numeric(14, 2) NOT NULL DEFAULT 0,
  withdrawal_amount numeric(14, 2) NOT NULL DEFAULT 0,
  net_revenue       numeric(14, 2) NOT NULL DEFAULT 0,
  commission_due    numeric(12, 2) NOT NULL DEFAULT 0,
  currency          text NOT NULL DEFAULT 'USD'
                    CHECK (currency IN ('USD', 'EUR', 'TRY')),
  source            text NOT NULL DEFAULT 'manual'
                    CHECK (source IN ('manual', 'csv', 'api', 'webhook')),
  imported_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT affiliate_daily_stats_clicks_nonneg CHECK (clicks >= 0),
  CONSTRAINT affiliate_daily_stats_regs_nonneg CHECK (registrations >= 0),
  CONSTRAINT affiliate_daily_stats_ftd_nonneg CHECK (ftd_count >= 0),
  CONSTRAINT affiliate_daily_stats_ftd_lte_regs CHECK (ftd_count <= registrations),
  UNIQUE (partner_id, stat_date)
);

CREATE INDEX IF NOT EXISTS idx_affiliate_daily_stats_brand_date
  ON public.affiliate_daily_stats (brand_id, stat_date DESC);

CREATE INDEX IF NOT EXISTS idx_affiliate_daily_stats_partner_date
  ON public.affiliate_daily_stats (partner_id, stat_date DESC);

COMMENT ON TABLE public.affiliate_daily_stats IS
  'Faz C: partner × gün performans satırı. UNIQUE(partner_id, stat_date); CSV import upsert ile günceller.';

DROP TRIGGER IF EXISTS tr_affiliate_daily_stats_updated ON public.affiliate_daily_stats;
CREATE TRIGGER tr_affiliate_daily_stats_updated
  BEFORE UPDATE ON public.affiliate_daily_stats
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.affiliate_daily_stats ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. affiliate_payouts
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.affiliate_payouts (
  id           text PRIMARY KEY,
  partner_id   text NOT NULL REFERENCES public.affiliate_partners(id) ON DELETE CASCADE,
  brand_id     text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end   date NOT NULL,
  amount       numeric(14, 2) NOT NULL,
  currency     text NOT NULL DEFAULT 'USD'
               CHECK (currency IN ('USD', 'EUR', 'TRY')),
  status       text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  paid_date    date,
  notes        text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT affiliate_payouts_period_order CHECK (period_start <= period_end),
  CONSTRAINT affiliate_payouts_amount_nonneg CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_brand_status
  ON public.affiliate_payouts (brand_id, status);

CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_brand_period
  ON public.affiliate_payouts (brand_id, period_end DESC);

CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_partner
  ON public.affiliate_payouts (partner_id, period_end DESC);

COMMENT ON TABLE public.affiliate_payouts IS
  'Faz C: partner ödeme dönemleri. Status: pending → approved → paid (veya cancelled).';

DROP TRIGGER IF EXISTS tr_affiliate_payouts_updated ON public.affiliate_payouts;
CREATE TRIGGER tr_affiliate_payouts_updated
  BEFORE UPDATE ON public.affiliate_payouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS policy placeholder'ları:
-- Faz D'de organization_member_brands tablosu eklendikten sonra brand-scoped
-- okuma/yazma policy'leri burada eklenecek. Şu anda uygulama service-role ile
-- yazar; RLS açık olduğundan anon/auth rolünün doğrudan erişimi yoktur.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- (Opsiyonel) Yardımcı view: partner başına agregeler. UI'da liste sayfasında
-- "toplam click / FTD / commission" özetini tek sorguda alabilmek için.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.affiliate_partner_totals AS
SELECT
  p.id                                                              AS partner_id,
  p.brand_id                                                        AS brand_id,
  COALESCE(SUM(s.clicks),            0)::integer                    AS total_clicks,
  COALESCE(SUM(s.registrations),     0)::integer                    AS total_registrations,
  COALESCE(SUM(s.ftd_count),         0)::integer                    AS total_ftd_count,
  COALESCE(SUM(s.ftd_amount),        0)::numeric(14, 2)             AS total_ftd_amount,
  COALESCE(SUM(s.deposit_amount),    0)::numeric(14, 2)             AS total_deposit_amount,
  COALESCE(SUM(s.withdrawal_amount), 0)::numeric(14, 2)             AS total_withdrawal_amount,
  COALESCE(SUM(s.net_revenue),       0)::numeric(14, 2)             AS total_net_revenue,
  COALESCE(SUM(s.commission_due),    0)::numeric(14, 2)             AS total_commission_due,
  MAX(s.stat_date)                                                  AS last_stat_date
FROM public.affiliate_partners p
LEFT JOIN public.affiliate_daily_stats s ON s.partner_id = p.id
GROUP BY p.id, p.brand_id;

COMMENT ON VIEW public.affiliate_partner_totals IS
  'Faz C yardımcı view: partner başına click/FTD/komisyon agregeleri (liste sayfası özet kartları için).';
