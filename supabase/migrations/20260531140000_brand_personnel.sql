-- Foxstream — Faz 3: Marka Personel & Takip (HR-lite)
--
-- Markaların kendi ekiplerini, görevlerini, vardiyalarını ve aktivite kaydını
-- yönetebilmesi için marka-kapsamlı (brand_id) tablolar.

CREATE TABLE IF NOT EXISTS public.brand_staff (
  id           text PRIMARY KEY,
  brand_id     text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  name         text NOT NULL,
  role         text NOT NULL DEFAULT '',
  email        text,
  phone        text,
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active','passive','invited')),
  monthly_cost numeric(14,2) NOT NULL DEFAULT 0,
  currency     text NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD','EUR','TRY')),
  avatar       text NOT NULL DEFAULT '',
  notes        text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brand_staff_brand ON public.brand_staff (brand_id);
DROP TRIGGER IF EXISTS tr_brand_staff_updated ON public.brand_staff;
CREATE TRIGGER tr_brand_staff_updated BEFORE UPDATE ON public.brand_staff
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.brand_staff ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.brand_staff_tasks (
  id          text PRIMARY KEY,
  brand_id    text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  staff_id    text REFERENCES public.brand_staff(id) ON DELETE SET NULL,
  title       text NOT NULL,
  description text NOT NULL DEFAULT '',
  status      text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done','cancelled')),
  priority    text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  due_date    date,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brand_staff_tasks_brand ON public.brand_staff_tasks (brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_staff_tasks_staff ON public.brand_staff_tasks (staff_id);
DROP TRIGGER IF EXISTS tr_brand_staff_tasks_updated ON public.brand_staff_tasks;
CREATE TRIGGER tr_brand_staff_tasks_updated BEFORE UPDATE ON public.brand_staff_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.brand_staff_tasks ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.brand_staff_shifts (
  id         text PRIMARY KEY,
  brand_id   text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  staff_id   text NOT NULL REFERENCES public.brand_staff(id) ON DELETE CASCADE,
  shift_date date NOT NULL,
  start_time text NOT NULL DEFAULT '09:00',
  end_time   text NOT NULL DEFAULT '18:00',
  note       text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brand_staff_shifts_brand ON public.brand_staff_shifts (brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_staff_shifts_staff ON public.brand_staff_shifts (staff_id);
CREATE INDEX IF NOT EXISTS idx_brand_staff_shifts_date ON public.brand_staff_shifts (shift_date);
DROP TRIGGER IF EXISTS tr_brand_staff_shifts_updated ON public.brand_staff_shifts;
CREATE TRIGGER tr_brand_staff_shifts_updated BEFORE UPDATE ON public.brand_staff_shifts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.brand_staff_shifts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.brand_staff_activity (
  id            text PRIMARY KEY,
  brand_id      text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  staff_id      text REFERENCES public.brand_staff(id) ON DELETE SET NULL,
  actor_user_id text,
  actor_name    text NOT NULL DEFAULT '',
  type          text NOT NULL DEFAULT 'note',
  detail        text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brand_staff_activity_brand ON public.brand_staff_activity (brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_brand_staff_activity_staff ON public.brand_staff_activity (staff_id);
ALTER TABLE public.brand_staff_activity ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
