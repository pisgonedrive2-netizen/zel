-- Yayıncı günlük görev bildirimlerinde tamamlanma zamanı
ALTER TABLE public.app_notifications
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

COMMENT ON COLUMN public.app_notifications.completed_at IS
  'Yayıncı günlük görev bildirimini tamamlandı olarak işaretlediğinde set edilir.';

CREATE INDEX IF NOT EXISTS idx_app_notifications_completed
  ON public.app_notifications (for_user_id, completed_at)
  WHERE completed_at IS NOT NULL;
