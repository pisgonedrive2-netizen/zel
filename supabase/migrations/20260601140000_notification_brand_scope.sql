-- Foxstream — Bildirim marka izolasyonu
--
-- Sorun: brand rolüne giden bildirimler yalnızca for_user_id ile sınırlıydı;
-- for_user_id NULL olan bir "brand" bildirimi TÜM markalara görünüyordu ve
-- bir markanın bildirimi aynı markadaki diğer ekip üyelerine görünmüyordu.
--
-- Çözüm: for_brand_id ekle. Brand bildirimleri artık markaya göre scope edilir:
--   teslim = (for_user_id = ben) OR (for_brand_id ∈ erişebildiğim markalar)
--            OR (for_user_id IS NULL AND for_brand_id IS NULL)  -- genel duyuru
-- Böylece her marka yalnızca kendi bildirimini görür; markalar arası sızma olmaz.

ALTER TABLE public.app_notifications
  ADD COLUMN IF NOT EXISTS for_brand_id text REFERENCES public.brands(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_app_notifications_brand
  ON public.app_notifications (for_brand_id);

CREATE INDEX IF NOT EXISTS idx_app_notifications_role_brand
  ON public.app_notifications (for_role, for_brand_id);

COMMENT ON COLUMN public.app_notifications.for_brand_id IS
  'Bildirimin ait olduğu marka (brand rolü izolasyonu). NULL + for_user_id NULL = genel duyuru.';

NOTIFY pgrst, 'reload schema';
