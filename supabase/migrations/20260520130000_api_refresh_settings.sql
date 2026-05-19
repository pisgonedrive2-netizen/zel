-- API otomatik yenileme ayarları (app_settings) + bildirim tipi

DO $$ BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'api_refresh_alert';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO public.app_settings (key, value)
VALUES
  (
    'apiRefresh.cronIntervalHours',
    '24'::jsonb
  ),
  (
    'apiRefresh.notifyEnabled',
    'true'::jsonb
  ),
  (
    'apiRefresh.notifyCooldownHours',
    '12'::jsonb
  )
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE public.app_settings IS
  'apiRefresh.* anahtarları: cron sıklığı (saat), bildirim açık/kapalı, bildirim bekleme süresi.';
