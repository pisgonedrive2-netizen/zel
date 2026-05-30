-- Foxstream — Faz 2: Self-Serve Yayıncı Kaydı
--
-- `streamer_registration_requests` — dışarıdan gelen yayıncı başvuruları.
-- Admin onayı sonrasında otomatik provizyon:
--   employees(kind=streamer) + app_users(role=streamer) + draft streamer_pool_profiles
-- başvuru kaydı audit için saklanır. (brand_registration_requests paralelinde.)

CREATE TABLE IF NOT EXISTS public.streamer_registration_requests (
  id                 text PRIMARY KEY,
  display_name       text NOT NULL,
  real_name          text,
  contact_email      text NOT NULL,
  contact_phone      text,
  telegram           text,
  platforms          text NOT NULL DEFAULT '',
  categories         text NOT NULL DEFAULT '',
  audience_size      text,
  preferred_username text,
  notes              text NOT NULL DEFAULT '',
  status             text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'approved', 'rejected', 'duplicate')),
  rejection_reason   text,
  reviewed_by        text REFERENCES public.app_users(id) ON DELETE SET NULL,
  reviewed_at        timestamptz,
  created_employee_id text REFERENCES public.employees(id) ON DELETE SET NULL,
  created_user_id    text REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_streamer_reg_requests_status
  ON public.streamer_registration_requests (status);
CREATE INDEX IF NOT EXISTS idx_streamer_reg_requests_created_at
  ON public.streamer_registration_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_streamer_reg_requests_email
  ON public.streamer_registration_requests (contact_email);

COMMENT ON TABLE public.streamer_registration_requests IS
  'Faz 2: dış yayıncı self-serve başvuruları. Admin onayı sonrası employee + app_user + pool profili oluşur.';

DROP TRIGGER IF EXISTS tr_streamer_reg_requests_updated ON public.streamer_registration_requests;
CREATE TRIGGER tr_streamer_reg_requests_updated
  BEFORE UPDATE ON public.streamer_registration_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.streamer_registration_requests ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
