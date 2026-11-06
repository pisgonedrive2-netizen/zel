-- Yeni harcamalar önce ana yöneticide; ekibe açılınca diğer admin/denetçiler görür.
ALTER TABLE public.content_expenses
  ADD COLUMN IF NOT EXISTS admin_released_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_released_by text;

CREATE INDEX IF NOT EXISTS idx_content_expenses_admin_released
  ON public.content_expenses (admin_released_at)
  WHERE admin_released_at IS NULL;

-- Mevcut kayıtlar ekibe zaten açık sayılır.
UPDATE public.content_expenses
SET admin_released_at = COALESCE(reviewed_at, submitted_at, now())
WHERE admin_released_at IS NULL;
