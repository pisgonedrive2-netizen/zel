-- Foxstream — Bildirim ayarları + uygulama ayarları tablosu.
--
-- Mevcut `app_notifications` tablosu sadece bildirim akışını tutuyor.
-- Bu migration ile:
--   1. Yönetici tarafından açık/kapalı yapılabilen kategori-bazlı tercihler
--      ve eşik değerleri için `app_settings` (anahtar/değer kayıtları).
--   2. Kullanıcı bazında bildirim tercihleri için `notification_preferences`.
--   3. Yeni bildirim tipi: `expense_paid` (ödeme onayı bilgisini yayıncıya iletmek).

DO $$ BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'expense_paid';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.app_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text REFERENCES public.app_users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id    text NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  type       notification_type NOT NULL,
  in_app     boolean NOT NULL DEFAULT true,
  desktop    boolean NOT NULL DEFAULT false,
  email      boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, type)
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user
  ON public.notification_preferences (user_id);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- updated_at trigger
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['app_settings', 'notification_preferences'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS tr_%s_updated ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER tr_%s_updated BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      t, t
    );
  END LOOP;
END $$;

-- Varsayılan ayarlar (ilk kurulumda doldur).
INSERT INTO public.app_settings (key, value)
VALUES
  ('notifications.kasaLowThreshold', '5000'::jsonb),
  ('notifications.payrollReminderEnabled', 'true'::jsonb),
  ('notifications.payrollReminderDaysBefore', '3'::jsonb),
  ('notifications.silencedTypes', '[]'::jsonb)
ON CONFLICT (key) DO NOTHING;
