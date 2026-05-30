-- Foxstream — Faz 0: Multi-tenant temeli (organizations + üyelik)
--
-- Yeni tablolar:
--   * organizations              — kiracı (tenant) sınırı: agency | brand | network
--   * organization_members       — bir org'da birden çok kullanıcı + org rolü
--   * organization_member_brands — üyenin erişebildiği markalar (scope_all_brands=false ise)
--
-- brands.organization_id eklenir. Mevcut 5 marka + kullanıcılar tek bir dahili
-- "Foxstream Ajansı" (agency) organizasyonuna backfill edilir; dışarıdan kayıt
-- olan her marka ayrı bir (type=brand) organizasyon olur ve izole başlar.
--
-- Tüm tablolar RLS açık; uygulama service-role anahtarı ile yazar.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. organizations
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organizations (
  id                    text PRIMARY KEY,
  name                  text NOT NULL,
  slug                  text NOT NULL UNIQUE,
  type                  text NOT NULL DEFAULT 'brand'
                        CHECK (type IN ('agency', 'brand', 'network')),
  status                text NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'suspended', 'closed')),
  plan                  text NOT NULL DEFAULT 'starter'
                        CHECK (plan IN ('starter', 'growth', 'enterprise', 'agency')),
  logo_url              text,
  primary_color         text NOT NULL DEFAULT '#FF6B00',
  locale                text NOT NULL DEFAULT 'tr',
  timezone              text NOT NULL DEFAULT 'Europe/Istanbul',
  default_currency      text NOT NULL DEFAULT 'USD'
                        CHECK (default_currency IN ('USD', 'EUR', 'TRY')),
  contact_name          text,
  contact_email         text,
  onboarding_completed  boolean NOT NULL DEFAULT false,
  created_from_request_id text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.organizations IS
  'Faz 0: multi-tenant kiracı sınırı. type=agency dahili Foxstream; type=brand dışarıdan kayıt.';

DROP TRIGGER IF EXISTS tr_organizations_updated ON public.organizations;
CREATE TRIGGER tr_organizations_updated
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. brands.organization_id
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS organization_id text REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_brands_organization ON public.brands (organization_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. organization_members
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organization_members (
  id               text PRIMARY KEY,
  organization_id  text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id          text NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  org_role         text NOT NULL DEFAULT 'viewer'
                   CHECK (org_role IN ('owner', 'admin', 'finance', 'marketing', 'hr', 'viewer')),
  scope_all_brands boolean NOT NULL DEFAULT true,
  title            text NOT NULL DEFAULT '',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.organization_members (organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members (user_id);

COMMENT ON TABLE public.organization_members IS
  'Faz 0: org içi kullanıcı + rol (owner/admin/finance/marketing/hr/viewer).';

DROP TRIGGER IF EXISTS tr_org_members_updated ON public.organization_members;
CREATE TRIGGER tr_org_members_updated
  BEFORE UPDATE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. organization_member_brands (scope_all_brands=false ise erişilen markalar)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organization_member_brands (
  member_id  text NOT NULL REFERENCES public.organization_members(id) ON DELETE CASCADE,
  brand_id   text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, brand_id)
);

CREATE INDEX IF NOT EXISTS idx_org_member_brands_brand ON public.organization_member_brands (brand_id);

ALTER TABLE public.organization_member_brands ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Backfill: dahili "Foxstream Ajansı" org + mevcut markalar + üyelikler
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.organizations (id, name, slug, type, status, plan, onboarding_completed)
VALUES ('org-foxstream', 'Foxstream Ajansı', 'foxstream', 'agency', 'active', 'agency', true)
ON CONFLICT (id) DO NOTHING;

-- Org'u olmayan tüm mevcut markaları dahili ajansa bağla.
UPDATE public.brands
  SET organization_id = 'org-foxstream'
  WHERE organization_id IS NULL;

-- Admin kullanıcıları: ajansın owner'ı, tüm markalara erişim.
INSERT INTO public.organization_members (id, organization_id, user_id, org_role, scope_all_brands)
SELECT 'om-' || u.id, 'org-foxstream', u.id, 'owner', true
  FROM public.app_users u
  WHERE u.role = 'admin'
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Marka kullanıcıları: ajansın admin'i, yalnızca kendi markasına erişim.
INSERT INTO public.organization_members (id, organization_id, user_id, org_role, scope_all_brands)
SELECT 'om-' || u.id, 'org-foxstream', u.id, 'admin', false
  FROM public.app_users u
  WHERE u.role = 'brand' AND u.brand_id IS NOT NULL
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Marka kullanıcılarının erişebildiği marka (scope) bağı.
INSERT INTO public.organization_member_brands (member_id, brand_id)
SELECT 'om-' || u.id, u.brand_id
  FROM public.app_users u
  WHERE u.role = 'brand' AND u.brand_id IS NOT NULL
ON CONFLICT (member_id, brand_id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
