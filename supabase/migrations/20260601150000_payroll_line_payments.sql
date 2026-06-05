-- Kalem bazlı maaş ödemeleri (temel maaş, kira, prim vb. ayrı ayrı ödendi işaretlenebilir)
ALTER TABLE public.payment_statuses
  ADD COLUMN IF NOT EXISTS line_payments jsonb NOT NULL DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
