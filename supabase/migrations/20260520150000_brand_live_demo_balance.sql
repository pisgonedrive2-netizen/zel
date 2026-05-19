-- Canlı yayın demo oyun bakiyesi (aylık, marka bazlı)

ALTER TABLE public.brand_monthly_stats
  ADD COLUMN IF NOT EXISTS live_demo_allocated numeric(16, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS live_demo_remaining numeric(16, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS live_demo_notes text NOT NULL DEFAULT '';

ALTER TABLE public.brand_monthly_stats
  DROP CONSTRAINT IF EXISTS brand_monthly_stats_live_demo_nonneg;

ALTER TABLE public.brand_monthly_stats
  ADD CONSTRAINT brand_monthly_stats_live_demo_nonneg
  CHECK (live_demo_allocated >= 0 AND live_demo_remaining >= 0);

COMMENT ON COLUMN public.brand_monthly_stats.live_demo_allocated IS
  'Canlı yayında oyun için ayrılan demo bakiye (ay başı / tahsis).';
COMMENT ON COLUMN public.brand_monthly_stats.live_demo_remaining IS
  'Kalan demo bakiye — canlı yayın sırasında güncellenir.';
COMMENT ON COLUMN public.brand_monthly_stats.live_demo_notes IS
  'Canlı yayın / demo bakiye notları (platform, oyun türü vb.).';
