-- İnce ayarlı (granular) kullanıcı yetkileri.
-- Yönetici (admin) / denetçi (auditor) hesaplarının hangi sayfa/veri/işlemleri
-- görüp göremeyeceğini kullanıcı bazında ezmek için sparse JSONB harita.
-- NULL = rol varsayılanları uygulanır (mevcut davranış korunur).

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS permissions jsonb;

COMMENT ON COLUMN public.app_users.permissions IS
  'İnce ayarlı yetki override haritası (capability -> boolean). NULL ise rol varsayılanları geçerli. Yalnızca ana yönetici düzenleyebilir.';
