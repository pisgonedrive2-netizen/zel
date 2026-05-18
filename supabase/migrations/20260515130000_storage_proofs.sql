-- Kanıt görselleri için public bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'proofs',
  'proofs',
  true,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public bucket URL'leri nesne listeleme policy'si gerektirmez.
-- Upload service_role kullanan Next.js API üzerinden yapılır.
DROP POLICY IF EXISTS "proofs_public_read" ON storage.objects;
