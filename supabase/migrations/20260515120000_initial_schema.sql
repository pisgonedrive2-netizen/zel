-- Foxstream — initial schema
-- Apply via Supabase SQL Editor or: supabase db push

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'streamer', 'auditor', 'brand');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE employee_kind AS ENUM ('streamer', 'coordinator', 'moderator', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE employee_status AS ENUM ('active', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE company_status AS ENUM ('active', 'inactive', 'ended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE project_status AS ENUM ('active', 'ongoing', 'paused');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE brand_status AS ENUM ('active', 'paused', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE link_status AS ENUM ('active', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE kasa_direction AS ENUM ('in', 'out');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE expense_review_status AS ENUM ('pending', 'approved', 'rejected', 'needs_info', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE weekly_plan_status AS ENUM ('planned', 'in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE salary_extra_type AS ENUM ('bonus', 'expense', 'deduction', 'rent', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE planned_priority AS ENUM ('high', 'medium', 'low');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE planned_status AS ENUM ('planned', 'in-progress', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM (
    'expense_submitted', 'expense_approved', 'expense_rejected',
    'schedule_updated', 'advance_request', 'kasa_low', 'payroll_reminder', 'general'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_for_role AS ENUM ('admin', 'auditor', 'streamer', 'brand');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sponsor_tx_status AS ENUM ('active', 'ended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- App users (PIN auth — verified server-side)
CREATE TABLE IF NOT EXISTS public.app_users (
  id            text PRIMARY KEY,
  username      text NOT NULL,
  pin_hash      text NOT NULL,
  name          text NOT NULL,
  role          user_role NOT NULL,
  employee_id   text,
  brand_id      text,
  avatar        text NOT NULL DEFAULT '',
  active        boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_users_username_lower UNIQUE (username)
);

CREATE INDEX IF NOT EXISTS idx_app_users_role ON public.app_users (role);
CREATE INDEX IF NOT EXISTS idx_app_users_employee ON public.app_users (employee_id);

CREATE TABLE IF NOT EXISTS public.employees (
  id                  text PRIMARY KEY,
  name                text NOT NULL,
  role                text NOT NULL DEFAULT '',
  department          text NOT NULL DEFAULT '',
  base_salary         numeric(14,2) NOT NULL DEFAULT 0,
  rent_support        numeric(14,2) NOT NULL DEFAULT 0,
  initial_advance     numeric(14,2) NOT NULL DEFAULT 0,
  payment_day         text NOT NULL DEFAULT '1-5',
  payroll_start_month text NOT NULL,
  start_date          date NOT NULL,
  status              employee_status NOT NULL DEFAULT 'active',
  wallet_address      text NOT NULL DEFAULT '',
  avatar              text NOT NULL DEFAULT '',
  notes               text NOT NULL DEFAULT '',
  kind                employee_kind NOT NULL DEFAULT 'streamer',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.advances (
  id          text PRIMARY KEY,
  employee_id text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  month       text NOT NULL,
  amount      numeric(14,2) NOT NULL,
  date        date NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_advances_emp_month ON public.advances (employee_id, month);

CREATE TABLE IF NOT EXISTS public.salary_extras (
  id          text PRIMARY KEY,
  employee_id text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  month       text NOT NULL,
  amount      numeric(14,2) NOT NULL,
  description text NOT NULL DEFAULT '',
  type        salary_extra_type NOT NULL DEFAULT 'other',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_salary_extras_emp_month ON public.salary_extras (employee_id, month);

CREATE TABLE IF NOT EXISTS public.payment_statuses (
  employee_id text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  month         text NOT NULL,
  paid          boolean NOT NULL DEFAULT false,
  paid_date     date,
  paid_by       text REFERENCES public.app_users(id) ON DELETE SET NULL,
  approved_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (employee_id, month)
);

CREATE TABLE IF NOT EXISTS public.external_companies (
  id                text PRIMARY KEY,
  name              text NOT NULL,
  category          text NOT NULL DEFAULT '',
  monthly_amount    numeric(14,2) NOT NULL DEFAULT 0,
  contact_person    text NOT NULL DEFAULT '',
  status            company_status NOT NULL DEFAULT 'active',
  start_date        date NOT NULL,
  notes             text NOT NULL DEFAULT '',
  monthly_breakdown numeric(14,2)[],
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sponsor_transactions (
  id           text PRIMARY KEY,
  date         date NOT NULL,
  company_name text NOT NULL,
  service      text NOT NULL DEFAULT '',
  amount       numeric(14,2) NOT NULL,
  status       sponsor_tx_status NOT NULL DEFAULT 'active',
  txid         text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.internal_projects (
  id              text PRIMARY KEY,
  name            text NOT NULL,
  category        text NOT NULL DEFAULT '',
  monthly_revenue numeric(14,2) NOT NULL DEFAULT 0,
  progress        integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  status          project_status NOT NULL DEFAULT 'active',
  start_date      date NOT NULL,
  notes           text NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.expense_entries (
  id          text PRIMARY KEY,
  category    text NOT NULL,
  amount      numeric(14,2) NOT NULL,
  date        date NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.planned_items (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  budget      numeric(14,2) NOT NULL,
  target_date date,
  priority    planned_priority NOT NULL DEFAULT 'medium',
  status      planned_status NOT NULL DEFAULT 'planned',
  notes       text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.streamer_accounts (
  id          text PRIMARY KEY,
  employee_id text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  platform    text NOT NULL,
  handle      text NOT NULL DEFAULT '',
  url         text NOT NULL DEFAULT '',
  notes       text NOT NULL DEFAULT '',
  status      link_status NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.schedule_slots (
  id          text PRIMARY KEY,
  employee_id text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  start_time  text NOT NULL,
  end_time    text NOT NULL,
  platform    text NOT NULL DEFAULT '',
  notes       text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.brands (
  id             text PRIMARY KEY,
  name           text NOT NULL,
  short_name     text NOT NULL,
  category       text NOT NULL DEFAULT '',
  status         brand_status NOT NULL DEFAULT 'active',
  notes          text NOT NULL DEFAULT '',
  monthly_target bigint,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.brand_links (
  id                  text PRIMARY KEY,
  brand_id            text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  platform            text NOT NULL,
  handle              text NOT NULL DEFAULT '',
  url                 text NOT NULL DEFAULT '',
  owner_id            text REFERENCES public.employees(id) ON DELETE SET NULL,
  status              link_status NOT NULL DEFAULT 'active',
  notes               text NOT NULL DEFAULT '',
  last_snapshot_date  date,
  last_views          bigint,
  auto_track          boolean DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.link_snapshots (
  id         text PRIMARY KEY,
  link_id    text NOT NULL REFERENCES public.brand_links(id) ON DELETE CASCADE,
  date       date NOT NULL,
  views      bigint NOT NULL DEFAULT 0,
  notes      text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.brand_viewership (
  id          text PRIMARY KEY,
  brand_name  text NOT NULL,
  employee_id text REFERENCES public.employees(id) ON DELETE SET NULL,
  brand_id    text REFERENCES public.brands(id) ON DELETE SET NULL,
  company_id  text REFERENCES public.external_companies(id) ON DELETE SET NULL,
  month       text NOT NULL,
  views       bigint NOT NULL DEFAULT 0,
  url         text NOT NULL DEFAULT '',
  notes       text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kasa_transactions (
  id           text PRIMARY KEY,
  date         timestamptz NOT NULL,
  direction    kasa_direction NOT NULL,
  amount_usd   numeric(14,2) NOT NULL,
  fee_usd      numeric(14,2) NOT NULL DEFAULT 0,
  purpose      text NOT NULL DEFAULT '',
  counterparty text NOT NULL DEFAULT '',
  proof        text NOT NULL DEFAULT '',
  notes        text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kasa_date ON public.kasa_transactions (date);

CREATE TABLE IF NOT EXISTS public.content_expenses (
  id              text PRIMARY KEY,
  date            date NOT NULL,
  month           text NOT NULL,
  employee_id     text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  brand_id        text REFERENCES public.brands(id) ON DELETE SET NULL,
  brand_name      text NOT NULL,
  category        text NOT NULL,
  description     text NOT NULL,
  amount_usd      numeric(14,2) NOT NULL,
  amount_thb      numeric(14,2),
  paid            boolean NOT NULL DEFAULT false,
  paid_date       date,
  notes           text NOT NULL DEFAULT '',
  screenshot_url  text,
  submitted_at    timestamptz,
  submitted_by    text REFERENCES public.app_users(id) ON DELETE SET NULL,
  review_status   expense_review_status NOT NULL DEFAULT 'pending',
  reviewed_at     timestamptz,
  reviewed_by     text REFERENCES public.app_users(id) ON DELETE SET NULL,
  reviewer_note   text,
  audited         boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_expenses_month ON public.content_expenses (month);
CREATE INDEX IF NOT EXISTS idx_content_expenses_review ON public.content_expenses (review_status);
CREATE INDEX IF NOT EXISTS idx_content_expenses_employee ON public.content_expenses (employee_id);

CREATE TABLE IF NOT EXISTS public.weekly_plans (
  id          text PRIMARY KEY,
  employee_id text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  week_start  date NOT NULL,
  date        date NOT NULL,
  start_time  text,
  end_time    text,
  activity    text NOT NULL,
  brand_name  text,
  notes       text NOT NULL DEFAULT '',
  status      weekly_plan_status NOT NULL DEFAULT 'planned',
  created_by  text REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_weekly_plans_emp_week ON public.weekly_plans (employee_id, week_start);

CREATE TABLE IF NOT EXISTS public.week_brand_reels (
  id            text PRIMARY KEY,
  employee_id   text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  week_start    date NOT NULL,
  brand_id      text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  content_url   text NOT NULL,
  platform      text NOT NULL DEFAULT '',
  brand_link_id text REFERENCES public.brand_links(id) ON DELETE SET NULL,
  notes         text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_notifications (
  id           text PRIMARY KEY,
  type         notification_type NOT NULL,
  title        text NOT NULL,
  message      text NOT NULL,
  for_role     notification_for_role NOT NULL,
  for_user_id  text REFERENCES public.app_users(id) ON DELETE CASCADE,
  ref_id       text,
  triggered_by text REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  read         boolean NOT NULL DEFAULT false,
  href         text,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_role_read ON public.app_notifications (for_role, read);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id         text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  actor_id   text NOT NULL,
  actor_name text NOT NULL,
  action     text NOT NULL,
  detail     text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs (created_at DESC);

-- Triggers: updated_at
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'app_users','employees','advances','salary_extras','payment_statuses',
    'external_companies','sponsor_transactions','internal_projects','expense_entries',
    'planned_items','streamer_accounts','schedule_slots','brands','brand_links',
    'link_snapshots','brand_viewership','kasa_transactions','content_expenses',
    'weekly_plans','week_brand_reels','app_notifications'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS tr_%s_updated ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER tr_%s_updated BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      t, t
    );
  END LOOP;
END $$;

-- SQL helpers (used by app / reports)
CREATE OR REPLACE FUNCTION public.sum_approved_content_expenses(
  p_employee_id text,
  p_month text
)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(amount_usd), 0)
  FROM public.content_expenses
  WHERE employee_id = p_employee_id
    AND month = p_month
    AND review_status NOT IN ('rejected', 'cancelled', 'pending', 'needs_info');
$$;

CREATE OR REPLACE FUNCTION public.pending_expense_count()
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::bigint FROM public.content_expenses WHERE review_status = 'pending';
$$;

CREATE OR REPLACE FUNCTION public.calc_kasa_balance(p_as_of timestamptz DEFAULT NULL)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(
    CASE
      WHEN direction = 'in' THEN amount_usd
      ELSE -(amount_usd + fee_usd)
    END
  ), 0)
  FROM public.kasa_transactions
  WHERE p_as_of IS NULL OR date <= p_as_of;
$$;

-- RLS: deny direct client API access (app uses service role via Next.js API)
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsor_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planned_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streamer_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.link_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_viewership ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kasa_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.week_brand_reels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated — service_role bypasses RLS
