-- Foxstream — Marka Ekip modülü genişletme
--
-- 1) brand_staff_attendance: günlük mesai / puantaj (giriş, çıkış, mola takibi)
-- 2) brand_staff_announcements: personel bilgilendirme / duyuru

CREATE TABLE IF NOT EXISTS public.brand_staff_attendance (
  id              text PRIMARY KEY,
  brand_id        text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  staff_id        text NOT NULL REFERENCES public.brand_staff(id) ON DELETE CASCADE,
  work_date       date NOT NULL,
  check_in        timestamptz,
  check_out       timestamptz,
  -- 'in' (mesaide) | 'on_break' (molada) | 'out' (çıkış yaptı)
  status          text NOT NULL DEFAULT 'out' CHECK (status IN ('in','on_break','out')),
  -- Toplam mola süresi (dakika) — tamamlanan molalar
  break_minutes   integer NOT NULL DEFAULT 0,
  -- Şu an molada ise molanın başladığı an (çıkışta hesaplanır)
  break_started_at timestamptz,
  note            text NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_brand_attendance_staff_day
  ON public.brand_staff_attendance (brand_id, staff_id, work_date);
CREATE INDEX IF NOT EXISTS idx_brand_attendance_brand
  ON public.brand_staff_attendance (brand_id, work_date DESC);
DROP TRIGGER IF EXISTS tr_brand_attendance_updated ON public.brand_staff_attendance;
CREATE TRIGGER tr_brand_attendance_updated BEFORE UPDATE ON public.brand_staff_attendance
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.brand_staff_attendance ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.brand_staff_announcements (
  id            text PRIMARY KEY,
  brand_id      text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  title         text NOT NULL,
  body          text NOT NULL DEFAULT '',
  -- 'all' | 'department' | 'staff'
  audience      text NOT NULL DEFAULT 'all' CHECK (audience IN ('all','department','staff')),
  department_id text REFERENCES public.brand_departments(id) ON DELETE SET NULL,
  staff_id      text REFERENCES public.brand_staff(id) ON DELETE SET NULL,
  -- 'info' | 'warning' | 'urgent'
  level         text NOT NULL DEFAULT 'info' CHECK (level IN ('info','warning','urgent')),
  pinned        boolean NOT NULL DEFAULT false,
  created_by    text,
  created_by_name text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brand_announcements_brand
  ON public.brand_staff_announcements (brand_id, pinned DESC, created_at DESC);
DROP TRIGGER IF EXISTS tr_brand_announcements_updated ON public.brand_staff_announcements;
CREATE TRIGGER tr_brand_announcements_updated BEFORE UPDATE ON public.brand_staff_announcements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.brand_staff_announcements ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
