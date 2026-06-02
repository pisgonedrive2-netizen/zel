-- Marka paneli achievement senkronu: brand_id + owner_id ile link taraması.
CREATE INDEX IF NOT EXISTS idx_brand_links_brand_owner_active
  ON public.brand_links (brand_id, owner_id)
  WHERE status = 'active' AND owner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_week_brand_reels_brand_emp
  ON public.week_brand_reels (brand_id, employee_id);

CREATE INDEX IF NOT EXISTS idx_week_brand_reels_brand_link
  ON public.week_brand_reels (brand_link_id)
  WHERE brand_link_id IS NOT NULL;
