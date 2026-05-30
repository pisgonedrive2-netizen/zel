-- Foxstream — Haftalık reel/gönderi linkleri için izlenme (API) metrikleri
--
-- Senaryo: Yayıncı profilindeki "Haftalık yayınlanan içerikler" kayıtları
-- (week_brand_reels) şimdiye dek yalnızca URL + yayın tarihi tutuyordu; izlenme
-- yoktu. Marka linkleri (brand_links) gibi bunlar da artık RapidAPI ile izlenme
-- çekebilir. Metrik kolonları sunucu (refresh) tarafından yönetilir.

ALTER TABLE public.week_brand_reels
  ADD COLUMN IF NOT EXISTS external_ref     text,
  ADD COLUMN IF NOT EXISTS last_views       integer,
  ADD COLUMN IF NOT EXISTS last_likes       integer,
  ADD COLUMN IF NOT EXISTS last_comments    integer,
  ADD COLUMN IF NOT EXISTS last_shares      integer,
  ADD COLUMN IF NOT EXISTS last_checked_at  timestamptz,
  ADD COLUMN IF NOT EXISTS last_check_error text,
  ADD COLUMN IF NOT EXISTS check_count      integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.week_brand_reels.last_views IS
  'Son RapidAPI ölçümünde alınan izlenme (play_count / view_count). Sunucu yönetir.';

NOTIFY pgrst, 'reload schema';
