-- Foxstream — Faz 5: Marka-kapsamlı muhasebe (defter + faturalar)
--
-- Her marka kendi gelir/gider defterini ve faturalarını tutar. Defter girişleri
-- manuel olabileceği gibi affiliate payout, kazanılan CRM anlaşması veya personel
-- maliyetinden otomatik beslenebilir (source + ref_id ile tekilleştirilir).

CREATE TABLE IF NOT EXISTS public.brand_ledger_entries (
  id          text PRIMARY KEY,
  brand_id    text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  entry_date  date NOT NULL DEFAULT CURRENT_DATE,
  direction   text NOT NULL DEFAULT 'expense' CHECK (direction IN ('income','expense')),
  category    text NOT NULL DEFAULT 'general',
  description text NOT NULL DEFAULT '',
  amount      numeric(14,2) NOT NULL DEFAULT 0,
  currency    text NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD','EUR','TRY')),
  source      text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','affiliate_payout','crm_deal','staff_cost','invoice')),
  ref_id      text,
  created_by  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brand_ledger_brand ON public.brand_ledger_entries (brand_id, entry_date DESC);
-- Otomatik kaynaklar için tekilleştirme (aynı payout/deal iki kez işlenmesin).
CREATE UNIQUE INDEX IF NOT EXISTS uq_brand_ledger_source_ref
  ON public.brand_ledger_entries (brand_id, source, ref_id)
  WHERE ref_id IS NOT NULL AND source <> 'manual';
DROP TRIGGER IF EXISTS tr_brand_ledger_updated ON public.brand_ledger_entries;
CREATE TRIGGER tr_brand_ledger_updated BEFORE UPDATE ON public.brand_ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.brand_ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.brand_invoices (
  id          text PRIMARY KEY,
  brand_id    text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  number      text NOT NULL DEFAULT '',
  contact_id  text REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  title       text NOT NULL DEFAULT '',
  status      text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','overdue','cancelled')),
  issue_date  date NOT NULL DEFAULT CURRENT_DATE,
  due_date    date,
  amount      numeric(14,2) NOT NULL DEFAULT 0,
  tax_pct     numeric(6,2) NOT NULL DEFAULT 0,
  currency    text NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD','EUR','TRY')),
  notes       text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brand_invoices_brand ON public.brand_invoices (brand_id, issue_date DESC);
DROP TRIGGER IF EXISTS tr_brand_invoices_updated ON public.brand_invoices;
CREATE TRIGGER tr_brand_invoices_updated BEFORE UPDATE ON public.brand_invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.brand_invoices ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
