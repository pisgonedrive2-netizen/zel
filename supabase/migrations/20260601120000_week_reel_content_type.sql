-- Foxstream — Haftalık reel/gönderi kayıtlarına içerik türü + "markaya bağlı değil"
--
-- 1) content_type: yayıncının o gün ne paylaştığı (reels / post / story / video /
--    canlı / diğer). Günlük içerik check-in formundan seçilir.
-- 2) brand_id artık NULL olabilir — "Diğer (markaya bağlı değil)" içerikler için.
--    (FK NULL'a izin verir; yalnızca NOT NULL kısıtını kaldırıyoruz.)

ALTER TABLE public.week_brand_reels
  ADD COLUMN IF NOT EXISTS content_type text;

ALTER TABLE public.week_brand_reels
  ALTER COLUMN brand_id DROP NOT NULL;

COMMENT ON COLUMN public.week_brand_reels.content_type IS
  'İçerik türü: reels | post | story | video | live | other. Check-in formundan.';

NOTIFY pgrst, 'reload schema';
