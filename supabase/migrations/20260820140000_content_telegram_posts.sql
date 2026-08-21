-- Takip edilen hesap videolarının Telegram grubuna iletim kuyruğu

CREATE TABLE IF NOT EXISTS public.content_telegram_posts (
  id                   text PRIMARY KEY,
  reel_id              text NOT NULL REFERENCES public.week_brand_reels(id) ON DELETE CASCADE,
  content_url          text NOT NULL,
  platform             text NOT NULL DEFAULT '',
  employee_id          text,
  status               text NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'skipped')),
  chat_id              text,
  telegram_message_id  bigint,
  error                text,
  attempts             integer NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  sent_at              timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_content_telegram_posts_reel
  ON public.content_telegram_posts (reel_id);

CREATE INDEX IF NOT EXISTS idx_content_telegram_posts_status_created
  ON public.content_telegram_posts (status, created_at);

ALTER TABLE public.content_telegram_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_content_telegram_posts" ON public.content_telegram_posts;
CREATE POLICY "service_role_all_content_telegram_posts" ON public.content_telegram_posts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

INSERT INTO public.app_settings (key, value)
VALUES
  ('telegramContent.enabled', 'false'::jsonb),
  ('telegramContent.chatId', '""'::jsonb),
  ('telegramContent.lookbackHours', '48'::jsonb),
  ('telegramContent.maxPerRun', '6'::jsonb)
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE public.content_telegram_posts IS
  'Kişisel hesaplardan çekilen videoların Telegram grubuna gönderim kuyruğu.';
