-- Ortak içerik harcaması: birden fazla markaya paylaştırılmış tutar
ALTER TABLE public.content_expenses
  ADD COLUMN IF NOT EXISTS brand_ids text[] DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_content_expenses_brand_ids
  ON public.content_expenses USING GIN (brand_ids);
