-- Foxstream — Faz 4: Marka CRM modülü (kontak + anlaşma + etkileşim)
--
-- Markaların kendi lead/kontak ve satış pipeline'larını yönetmesi için
-- brand-scoped tablolar. crm_deals affiliate partner ve brand_deal kayıtlarına
-- (gevşek) bağlanabilir.

CREATE TABLE IF NOT EXISTS public.crm_contacts (
  id          text PRIMARY KEY,
  brand_id    text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  name        text NOT NULL,
  company     text NOT NULL DEFAULT '',
  email       text,
  phone       text,
  telegram    text,
  source      text NOT NULL DEFAULT 'manual',
  status      text NOT NULL DEFAULT 'lead' CHECK (status IN ('lead','active','vip','passive','lost')),
  owner       text NOT NULL DEFAULT '',
  tags        text[] NOT NULL DEFAULT '{}',
  notes       text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_brand ON public.crm_contacts (brand_id);
DROP TRIGGER IF EXISTS tr_crm_contacts_updated ON public.crm_contacts;
CREATE TRIGGER tr_crm_contacts_updated BEFORE UPDATE ON public.crm_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.crm_deals (
  id             text PRIMARY KEY,
  brand_id       text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  contact_id     text REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  title          text NOT NULL,
  stage          text NOT NULL DEFAULT 'lead' CHECK (stage IN ('lead','qualified','proposal','won','lost')),
  value          numeric(14,2) NOT NULL DEFAULT 0,
  currency       text NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD','EUR','TRY')),
  probability    integer NOT NULL DEFAULT 50,
  expected_close date,
  affiliate_partner_id text,
  brand_deal_id  text,
  notes          text NOT NULL DEFAULT '',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crm_deals_brand ON public.crm_deals (brand_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_contact ON public.crm_deals (contact_id);
DROP TRIGGER IF EXISTS tr_crm_deals_updated ON public.crm_deals;
CREATE TRIGGER tr_crm_deals_updated BEFORE UPDATE ON public.crm_deals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.crm_deals ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.crm_interactions (
  id          text PRIMARY KEY,
  brand_id    text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  contact_id  text REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  deal_id     text REFERENCES public.crm_deals(id) ON DELETE SET NULL,
  type        text NOT NULL DEFAULT 'note' CHECK (type IN ('note','call','email','meeting','whatsapp','telegram')),
  summary     text NOT NULL DEFAULT '',
  actor_name  text NOT NULL DEFAULT '',
  actor_user_id text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crm_interactions_brand ON public.crm_interactions (brand_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_interactions_contact ON public.crm_interactions (contact_id);
ALTER TABLE public.crm_interactions ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
