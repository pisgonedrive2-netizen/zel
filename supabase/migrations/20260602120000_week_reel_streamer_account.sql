-- Kişisel yayıncı hesaplarından (streamer_accounts) achievement kaynağı
ALTER TABLE public.week_brand_reels
  ADD COLUMN IF NOT EXISTS streamer_account_id text
  REFERENCES public.streamer_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_week_brand_reels_streamer_account
  ON public.week_brand_reels (streamer_account_id)
  WHERE streamer_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_week_brand_reels_emp_published
  ON public.week_brand_reels (employee_id, published_at DESC);

COMMENT ON COLUMN public.week_brand_reels.streamer_account_id IS
  'Yayıncının kişisel IG/TT/YT hesabından API ile senkronlanan içerik.';

NOTIFY pgrst, 'reload schema';
