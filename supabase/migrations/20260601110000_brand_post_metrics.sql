-- Foxstream — Marka postları (brand_posts) için izlenme (API) metrikleri
--
-- Senaryo: brand_posts şimdiye dek yalnızca manuel girilen views/likes/comments
-- tutuyordu. Marka linkleri (brand_links) ve haftalık reel'ler (week_brand_reels)
-- gibi bunlar da artık RapidAPI ile izlenme çekebilir. Bu son-ölçüm kolonları
-- sunucu (refresh) tarafından yönetilir; mevcut views/likes/comments alanlarına
-- (manuel/denormalize akışı) dokunulmaz.

ALTER TABLE public.brand_posts
  ADD COLUMN IF NOT EXISTS external_ref     text,
  ADD COLUMN IF NOT EXISTS last_views       bigint,
  ADD COLUMN IF NOT EXISTS last_likes       integer,
  ADD COLUMN IF NOT EXISTS last_comments    integer,
  ADD COLUMN IF NOT EXISTS last_shares      integer,
  ADD COLUMN IF NOT EXISTS last_checked_at  timestamptz,
  ADD COLUMN IF NOT EXISTS last_check_error text,
  ADD COLUMN IF NOT EXISTS check_count      integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.brand_posts.last_views IS
  'Son RapidAPI ölçümünde alınan izlenme (play_count / view_count). Sunucu yönetir.';

NOTIFY pgrst, 'reload schema';
