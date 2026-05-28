-- Foxstream — Faz A: Self-Serve Marka Kaydı
--
-- Yeni tablo: `brand_registration_requests` — dışarıdan gelen marka başvuruları.
-- Admin onayı sonrasında `brands` + `app_users` satırı otomatik üretilir; bu
-- başvuru kaydı ileride audit için saklanır.
--
-- İlgili eklemeler:
--   1. `brands.created_from_request_id`     — onay zinciri için referans (audit).
--   2. `app_settings.brand_registration_enabled` — varsayılan `true` (kayıt açık).
--   3. RLS açık ancak policy yok → uygulama service-role ile yazar.
--   4. `set_updated_at` trigger'ı `tr_brand_registration_requests_updated`.

CREATE TABLE IF NOT EXISTS public.brand_registration_requests (
  id                 text PRIMARY KEY,
  brand_name         text NOT NULL,
  short_name         text,
  category           text NOT NULL DEFAULT 'Bahis',
  website            text,
  contact_name       text NOT NULL,
  contact_email      text NOT NULL,
  contact_phone      text,
  telegram           text,
  monthly_volume     text,
  preferred_username text,
  notes              text NOT NULL DEFAULT '',
  status             text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'approved', 'rejected', 'duplicate')),
  rejection_reason   text,
  reviewed_by        text REFERENCES public.app_users(id) ON DELETE SET NULL,
  reviewed_at        timestamptz,
  created_brand_id   text REFERENCES public.brands(id) ON DELETE SET NULL,
  created_user_id    text REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_registration_requests_status
  ON public.brand_registration_requests (status);

CREATE INDEX IF NOT EXISTS idx_brand_registration_requests_created_at
  ON public.brand_registration_requests (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_brand_registration_requests_contact_email
  ON public.brand_registration_requests (contact_email);

COMMENT ON TABLE public.brand_registration_requests IS
  'Dış marka temsilcilerinin self-serve başvuruları. Admin onayı sonrası brands + app_users satırı oluşur.';
COMMENT ON COLUMN public.brand_registration_requests.status IS 'pending | approved | rejected | duplicate';
COMMENT ON COLUMN public.brand_registration_requests.created_brand_id IS
  'Onay sonrasında üretilen brands.id (audit zinciri).';
COMMENT ON COLUMN public.brand_registration_requests.created_user_id IS
  'Onay sonrasında üretilen app_users.id (marka kullanıcısı).';

DROP TRIGGER IF EXISTS tr_brand_registration_requests_updated ON public.brand_registration_requests;
CREATE TRIGGER tr_brand_registration_requests_updated
  BEFORE UPDATE ON public.brand_registration_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.brand_registration_requests ENABLE ROW LEVEL SECURITY;

-- brands.created_from_request_id — audit zinciri (her onaylanan başvuru = 1 marka)
ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS created_from_request_id text
  REFERENCES public.brand_registration_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_brands_created_from_request
  ON public.brands (created_from_request_id);

COMMENT ON COLUMN public.brands.created_from_request_id IS
  'Self-serve onay zinciri: bu markayı oluşturan brand_registration_requests.id (audit, nullable).';

-- DB tabanlı flag: ENV yerine `app_settings`'ten okunabilsin.
INSERT INTO public.app_settings (key, value)
VALUES ('brand_registration_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

COMMENT ON COLUMN public.app_settings.key IS
  'Bilinen anahtarlar: notifications.*, api.refresh.*, brand_registration_enabled.';
