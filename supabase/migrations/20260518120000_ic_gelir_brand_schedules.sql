-- İç gelir: marka + yayıncı bağlantısı, ödeme günü, hatırlatma alanları ve aylık tahsilat kayıtları.

ALTER TABLE public.internal_projects
  ADD COLUMN IF NOT EXISTS brand_id text REFERENCES public.brands(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS employee_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS payment_day text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS reminder_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_days_before integer NOT NULL DEFAULT 3 CHECK (reminder_days_before >= 0 AND reminder_days_before <= 30),
  ADD COLUMN IF NOT EXISTS last_reminder_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_internal_projects_brand ON public.internal_projects (brand_id);

CREATE TABLE IF NOT EXISTS public.internal_project_payments (
  id          text PRIMARY KEY,
  project_id  text NOT NULL REFERENCES public.internal_projects(id) ON DELETE CASCADE,
  month       text NOT NULL,
  due_date    date,
  amount      numeric(14,2) NOT NULL DEFAULT 0,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  paid_date   date,
  notes       text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_internal_project_payments_project ON public.internal_project_payments (project_id);
CREATE INDEX IF NOT EXISTS idx_internal_project_payments_month ON public.internal_project_payments (month);

ALTER TABLE public.internal_project_payments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS tr_internal_project_payments_updated ON public.internal_project_payments';
  EXECUTE 'CREATE TRIGGER tr_internal_project_payments_updated BEFORE UPDATE ON public.internal_project_payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
END $$;
