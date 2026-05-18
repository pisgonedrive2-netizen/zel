ALTER TABLE public.payment_statuses
  ADD COLUMN IF NOT EXISTS paid_by text REFERENCES public.app_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_payment_statuses_paid_by ON public.payment_statuses (paid_by);
