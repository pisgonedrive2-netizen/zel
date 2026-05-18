-- Planlanan: kategori, tarih aralığı, harcama, bağlantılar, tekrar, taksit kayıtları, ek durumlar.

ALTER TYPE public.planned_status ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE public.planned_status ADD VALUE IF NOT EXISTS 'postponed';

ALTER TABLE public.planned_items
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS spent numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS employee_id text REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS brand_id text REFERENCES public.brands(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS internal_project_id text REFERENCES public.internal_projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence text NOT NULL DEFAULT 'none'
    CHECK (recurrence IN ('none', 'monthly', 'quarterly', 'yearly')),
  ADD COLUMN IF NOT EXISTS expense_entry_id text;

CREATE INDEX IF NOT EXISTS idx_planned_items_category ON public.planned_items (category);
CREATE INDEX IF NOT EXISTS idx_planned_items_target_date ON public.planned_items (target_date);
CREATE INDEX IF NOT EXISTS idx_planned_items_employee ON public.planned_items (employee_id);

CREATE TABLE IF NOT EXISTS public.planned_item_payments (
  id              text PRIMARY KEY,
  planned_item_id text NOT NULL REFERENCES public.planned_items(id) ON DELETE CASCADE,
  month           text NOT NULL,
  due_date        date,
  amount          numeric(14,2) NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  paid_date       date,
  notes           text NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_planned_item_payments_item ON public.planned_item_payments (planned_item_id);
CREATE INDEX IF NOT EXISTS idx_planned_item_payments_month ON public.planned_item_payments (month);

ALTER TABLE public.planned_item_payments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS tr_planned_item_payments_updated ON public.planned_item_payments';
  EXECUTE 'CREATE TRIGGER tr_planned_item_payments_updated BEFORE UPDATE ON public.planned_item_payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
END $$;
