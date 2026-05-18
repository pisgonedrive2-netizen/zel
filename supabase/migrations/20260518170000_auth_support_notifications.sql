-- Foxstream — Giriş destek talepleri + eksik bildirim enum değerleri
--
-- 1. brand_payment_reminder: uygulama kodunda kullanılıyordu, enum'da yoktu.
-- 2. password_reset_request / account_registration_request: login sayfası talepleri.
-- 3. ref_id indeksi: şifre sıfırlama / kayıt talebi tekrar kontrolü için.

DO $$ BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'brand_payment_reminder';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'password_reset_request';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'account_registration_request';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_ref_id
  ON public.app_notifications (ref_id)
  WHERE ref_id IS NOT NULL;
