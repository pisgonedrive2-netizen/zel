-- link_snapshots tablosuna engagement metrik kolonları
-- (likes/comments/shares) — tarihsel takip için.
-- brand_links zaten last_likes/last_comments/last_shares tutuyor
-- ama günlük geçmişi PDF/dashboard'da göstermek için snapshot'larda da gerekli.

ALTER TABLE public.link_snapshots
  ADD COLUMN IF NOT EXISTS likes      bigint,
  ADD COLUMN IF NOT EXISTS comments   bigint,
  ADD COLUMN IF NOT EXISTS shares     bigint,
  ADD COLUMN IF NOT EXISTS refreshed_at timestamptz;

COMMENT ON COLUMN public.link_snapshots.likes IS
  'O günkü API çekimine ait beğeni sayısı (null = ölçülmedi).';
COMMENT ON COLUMN public.link_snapshots.comments IS
  'O günkü API çekimine ait yorum sayısı (null = ölçülmedi).';
COMMENT ON COLUMN public.link_snapshots.shares IS
  'O günkü API çekimine ait paylaşım sayısı (null = ölçülmedi).';
COMMENT ON COLUMN public.link_snapshots.refreshed_at IS
  'API yenileme anının kesin zaman damgası (UTC).';

-- brand_links: refresh sayacı (ay başına kaç kez yenilendi) — UI'da göstermek için
ALTER TABLE public.brand_links
  ADD COLUMN IF NOT EXISTS refresh_count_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_refresh_status text;

COMMENT ON COLUMN public.brand_links.refresh_count_total IS
  'Toplam başarılı API yenileme sayısı.';
COMMENT ON COLUMN public.brand_links.last_refresh_status IS
  'Son yenilemenin sonucu: ok | error | quota | not_supported';

-- BrandLink.createdAt'i client tarafından okumak için index (created_at zaten var)
CREATE INDEX IF NOT EXISTS idx_brand_links_created_at
  ON public.brand_links (created_at DESC);
