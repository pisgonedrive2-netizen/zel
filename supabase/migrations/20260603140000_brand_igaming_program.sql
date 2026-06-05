-- Marka iGaming program — çekirdek tablolar (yol haritası §0–§22)
-- Uygulama service-role + ensureBrandAccess; RLS deny-by-default + service_role policy

-- ── brand_monthly_stats genişletme ───────────────────────────────────────────
ALTER TABLE public.brand_monthly_stats
  ADD COLUMN IF NOT EXISTS active_players integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS churn_rate numeric(6, 3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS arpu numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS arppu numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_cost numeric(16, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ggr numeric(16, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ngr numeric(16, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_total numeric(16, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS channel_segment text NOT NULL DEFAULT 'all';

COMMENT ON COLUMN public.brand_monthly_stats.ggr IS 'Gross gaming revenue (aylık)';
COMMENT ON COLUMN public.brand_monthly_stats.ngr IS 'Net gaming revenue (aylık)';

-- ── brands iGaming meta ────────────────────────────────────────────────────
ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS license_jurisdiction text,
  ADD COLUMN IF NOT EXISTS restricted_geos text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS igaming_settings jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ── Ortak yardımcı: brand-scoped tablolar ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.brand_operators (
  id text PRIMARY KEY,
  brand_id text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  name text NOT NULL,
  api_base_url text,
  currency text NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'EUR', 'TRY')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'closed')),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brand_operators_brand ON public.brand_operators (brand_id);

CREATE TABLE IF NOT EXISTS public.brand_api_keys (
  id text PRIMARY KEY,
  brand_id text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  operator_id text REFERENCES public.brand_operators(id) ON DELETE SET NULL,
  label text NOT NULL DEFAULT 'default',
  key_hash text NOT NULL,
  key_prefix text NOT NULL,
  scopes text[] NOT NULL DEFAULT '{webhook:read,webhook:write}',
  last_used_at timestamptz,
  expires_at timestamptz,
  created_by text REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_brand_api_keys_brand ON public.brand_api_keys (brand_id);

CREATE TABLE IF NOT EXISTS public.brand_audit_log (
  id text PRIMARY KEY,
  brand_id text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  actor_id text,
  actor_name text,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  detail text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brand_audit_log_brand ON public.brand_audit_log (brand_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.brand_player_events (
  id text PRIMARY KEY,
  brand_id text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  event_date date NOT NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'registration', 'ftd', 'deposit', 'withdrawal', 'chargeback', 'active_player'
  )),
  channel text NOT NULL DEFAULT 'all' CHECK (channel IN ('all', 'affiliate', 'organic', 'influencer')),
  country_code text,
  event_count integer NOT NULL DEFAULT 0,
  amount numeric(16, 2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'EUR', 'TRY')),
  import_batch_id text,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'csv', 'api', 'webhook')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, event_date, event_type, channel, country_code)
);
CREATE INDEX IF NOT EXISTS idx_brand_player_events_brand_date
  ON public.brand_player_events (brand_id, event_date DESC);

CREATE TABLE IF NOT EXISTS public.brand_kpi_targets (
  id text PRIMARY KEY,
  brand_id text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  month text NOT NULL CHECK (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  target_ftd integer NOT NULL DEFAULT 0,
  target_registrations integer NOT NULL DEFAULT 0,
  target_deposit_amount numeric(16, 2) NOT NULL DEFAULT 0,
  target_ngr numeric(16, 2) NOT NULL DEFAULT 0,
  target_content_deliveries integer NOT NULL DEFAULT 0,
  target_affiliate_roi numeric(8, 2),
  notes text NOT NULL DEFAULT '',
  updated_by text REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, month)
);

CREATE TABLE IF NOT EXISTS public.brand_campaigns (
  id text PRIMARY KEY,
  brand_id text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  name text NOT NULL,
  campaign_type text NOT NULL DEFAULT 'bonus'
    CHECK (campaign_type IN ('bonus', 'tournament', 'landing', 'promo', 'affiliate')),
  promo_code text,
  start_date date,
  end_date date,
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'ended')),
  budget_usd numeric(14, 2),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brand_campaigns_brand ON public.brand_campaigns (brand_id, status);

CREATE TABLE IF NOT EXISTS public.brand_compliance_checks (
  id text PRIMARY KEY,
  brand_id text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  check_type text NOT NULL CHECK (check_type IN (
    'kyc', 'geo_restrict', 'responsible_gaming', 'ad_disclosure', 'license', 'other'
  )),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'passed', 'failed', 'waived')),
  due_date date,
  completed_at timestamptz,
  evidence_url text,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brand_compliance_brand ON public.brand_compliance_checks (brand_id, status);

CREATE TABLE IF NOT EXISTS public.brand_risk_flags (
  id text PRIMARY KEY,
  brand_id text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  flag_date date NOT NULL DEFAULT CURRENT_DATE,
  severity text NOT NULL DEFAULT 'warn' CHECK (severity IN ('info', 'warn', 'critical')),
  category text NOT NULL DEFAULT 'fraud',
  score numeric(6, 2),
  message text NOT NULL,
  resolved_at timestamptz,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brand_risk_flags_brand ON public.brand_risk_flags (brand_id, flag_date DESC);

CREATE TABLE IF NOT EXISTS public.brand_live_sessions (
  id text PRIMARY KEY,
  brand_id text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  employee_id text REFERENCES public.employees(id) ON DELETE SET NULL,
  deal_id text REFERENCES public.brand_deals(id) ON DELETE SET NULL,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  actual_start timestamptz,
  actual_end timestamptz,
  peak_viewers integer NOT NULL DEFAULT 0,
  platform text,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.brand_calendar_events (
  id text PRIMARY KEY,
  brand_id text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  event_date date NOT NULL,
  title text NOT NULL,
  event_type text NOT NULL DEFAULT 'campaign'
    CHECK (event_type IN ('campaign', 'compliance', 'launch', 'payout', 'content', 'other')),
  ref_id text,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brand_calendar_brand_date
  ON public.brand_calendar_events (brand_id, event_date);

CREATE TABLE IF NOT EXISTS public.brand_offer_templates (
  id text PRIMARY KEY,
  brand_id text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  name text NOT NULL,
  offer_type text NOT NULL DEFAULT 'campaign',
  commission_model text,
  default_budget_usd numeric(14, 2),
  deliverables jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.brand_deal_milestones (
  id text PRIMARY KEY,
  brand_id text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  deal_id text NOT NULL REFERENCES public.brand_deals(id) ON DELETE CASCADE,
  due_date date,
  title text NOT NULL,
  kpi_type text,
  kpi_target numeric(14, 2),
  kpi_actual numeric(14, 2),
  payment_amount numeric(14, 2),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'met', 'missed', 'paid')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.brand_deal_tracking_links (
  id text PRIMARY KEY,
  brand_id text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  deal_id text NOT NULL REFERENCES public.brand_deals(id) ON DELETE CASCADE,
  url text NOT NULL,
  promo_code text,
  utm_source text,
  utm_campaign text,
  external_ref text,
  attributed_ftd integer NOT NULL DEFAULT 0,
  attributed_deposit numeric(14, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.brand_tracking_domains (
  id text PRIMARY KEY,
  brand_id text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  domain text NOT NULL,
  ssl_ok boolean NOT NULL DEFAULT true,
  last_checked_at timestamptz,
  notes text NOT NULL DEFAULT '',
  UNIQUE (brand_id, domain)
);

CREATE TABLE IF NOT EXISTS public.brand_post_approvals (
  id text PRIMARY KEY,
  brand_id text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  post_id text NOT NULL REFERENCES public.brand_posts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by text REFERENCES public.app_users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.brand_content_violations (
  id text PRIMARY KEY,
  brand_id text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  post_id text REFERENCES public.brand_posts(id) ON DELETE SET NULL,
  violation_type text NOT NULL,
  severity text NOT NULL DEFAULT 'warn' CHECK (severity IN ('info', 'warn', 'block')),
  resolved_at timestamptz,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.affiliate_tiers (
  id text PRIMARY KEY,
  brand_id text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  name text NOT NULL,
  min_ftd integer NOT NULL DEFAULT 0,
  commission_pct numeric(6, 2) NOT NULL DEFAULT 0,
  cpa_amount numeric(12, 2) NOT NULL DEFAULT 0,
  carryover boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.affiliate_campaigns (
  id text PRIMARY KEY,
  brand_id text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  name text NOT NULL,
  promo_code text,
  landing_url text,
  geo_allowlist text[] NOT NULL DEFAULT '{}',
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'ended')),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.affiliate_quality_scores (
  id text PRIMARY KEY,
  brand_id text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  partner_id text NOT NULL REFERENCES public.affiliate_partners(id) ON DELETE CASCADE,
  score_date date NOT NULL DEFAULT CURRENT_DATE,
  quality_score numeric(6, 2) NOT NULL DEFAULT 0,
  fraud_flags integer NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  UNIQUE (partner_id, score_date)
);

CREATE TABLE IF NOT EXISTS public.brand_department_budgets (
  id text PRIMARY KEY,
  brand_id text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  department_id text NOT NULL REFERENCES public.brand_departments(id) ON DELETE CASCADE,
  month text NOT NULL CHECK (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  planned_amount numeric(14, 2) NOT NULL DEFAULT 0,
  actual_amount numeric(14, 2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  UNIQUE (department_id, month)
);

CREATE TABLE IF NOT EXISTS public.brand_tasks (
  id text PRIMARY KEY,
  brand_id text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  assignee_user_id text REFERENCES public.app_users(id) ON DELETE SET NULL,
  staff_id text REFERENCES public.brand_staff(id) ON DELETE SET NULL,
  due_date date,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done', 'cancelled')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  campaign_id text REFERENCES public.brand_campaigns(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.brand_sla_policies (
  id text PRIMARY KEY,
  brand_id text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  policy_type text NOT NULL,
  hours_limit integer NOT NULL DEFAULT 24,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.brand_payment_schedules (
  id text PRIMARY KEY,
  brand_id text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  deal_id text REFERENCES public.brand_deals(id) ON DELETE SET NULL,
  due_date date NOT NULL,
  amount_usd numeric(14, 2) NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'paid', 'cancelled')),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.brand_notification_rules (
  id text PRIMARY KEY,
  brand_id text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  channel text NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app', 'email', 'telegram')),
  enabled boolean NOT NULL DEFAULT true,
  threshold jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.brand_onboarding_progress (
  brand_id text PRIMARY KEY REFERENCES public.brands(id) ON DELETE CASCADE,
  steps jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.brand_support_tickets (
  id text PRIMARY KEY,
  brand_id text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  subject text NOT NULL,
  body text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending', 'resolved', 'closed')),
  priority text NOT NULL DEFAULT 'normal',
  created_by text REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.brand_deal_invoices (
  id text PRIMARY KEY,
  brand_id text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  deal_id text NOT NULL REFERENCES public.brand_deals(id) ON DELETE CASCADE,
  amount numeric(14, 2) NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'cancelled')),
  paid_at timestamptz,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.brand_fx_rates (
  id text PRIMARY KEY,
  brand_id text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  month text NOT NULL,
  from_currency text NOT NULL,
  to_currency text NOT NULL,
  rate numeric(14, 6) NOT NULL,
  UNIQUE (brand_id, month, from_currency, to_currency)
);

CREATE TABLE IF NOT EXISTS public.brand_import_batches (
  id text PRIMARY KEY,
  brand_id text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  source text NOT NULL,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'done', 'failed')),
  rows_total integer NOT NULL DEFAULT 0,
  rows_imported integer NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.brand_webhook_logs (
  id text PRIMARY KEY,
  brand_id text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  operator_id text,
  event_type text NOT NULL,
  status_code integer,
  payload jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brand_webhook_logs_brand ON public.brand_webhook_logs (brand_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.streamer_compliance_docs (
  id text PRIMARY KEY,
  brand_id text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  employee_id text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  doc_type text NOT NULL DEFAULT 'contract',
  storage_path text,
  expires_at date,
  signed_at date,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.organization_member_permissions (
  member_id text PRIMARY KEY REFERENCES public.organization_members(id) ON DELETE CASCADE,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.streamer_pool_profiles
  ADD COLUMN IF NOT EXISTS igaming_tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS restricted_markets text[] NOT NULL DEFAULT '{}';

-- updated_at triggers
DO $tr$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'brand_operators','brand_campaigns','brand_compliance_checks','brand_live_sessions',
    'brand_offer_templates','brand_deal_milestones','brand_deal_tracking_links',
    'brand_player_events','brand_kpi_targets','affiliate_campaigns','brand_tasks',
    'brand_support_tickets','brand_onboarding_progress'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS tr_%s_updated ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER tr_%s_updated BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      t, t
    );
  END LOOP;
END $tr$;

-- RLS
DO $rls$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'brand_operators','brand_api_keys','brand_audit_log','brand_player_events',
    'brand_kpi_targets','brand_campaigns','brand_compliance_checks','brand_risk_flags',
    'brand_live_sessions','brand_calendar_events','brand_offer_templates',
    'brand_deal_milestones','brand_deal_tracking_links','brand_tracking_domains',
    'brand_post_approvals','brand_content_violations','affiliate_tiers',
    'affiliate_campaigns','affiliate_quality_scores','brand_department_budgets',
    'brand_tasks','brand_sla_policies','brand_payment_schedules',
    'brand_notification_rules','brand_onboarding_progress','brand_support_tickets',
    'brand_deal_invoices','brand_fx_rates','brand_import_batches','brand_webhook_logs',
    'streamer_compliance_docs','organization_member_permissions'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS service_role_all_%s ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY service_role_all_%s ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      t, t
    );
  END LOOP;
END $rls$;

-- Dashboard özet view (anasayfa)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_brand_dashboard_monthly AS
SELECT
  b.id AS brand_id,
  s.month,
  s.new_registrations,
  s.first_time_depositors AS ftd,
  s.depositing_members AS active_depositors,
  s.deposit_amount,
  s.withdrawal_amount,
  s.ggr,
  s.ngr,
  s.commission_total,
  s.active_players,
  COALESCE(t.target_ftd, 0) AS target_ftd,
  COALESCE(t.target_ngr, 0) AS target_ngr
FROM public.brands b
LEFT JOIN public.brand_monthly_stats s ON s.brand_id = b.id
LEFT JOIN public.brand_kpi_targets t ON t.brand_id = b.id AND t.month = s.month
WHERE b.status != 'inactive';

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_brand_dashboard_monthly
  ON public.mv_brand_dashboard_monthly (brand_id, month);

COMMENT ON MATERIALIZED VIEW public.mv_brand_dashboard_monthly IS
  'Marka anasayfa KPI özeti — cron ile REFRESH MATERIALIZED VIEW CONCURRENTLY önerilir.';
