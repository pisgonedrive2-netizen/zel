-- ─────────────────────────────────────────────────────────────────────────────
-- TRON harcamasının Genel Kasa'ya dahil edilmesi
-- ─────────────────────────────────────────────────────────────────────────────
-- Ramiz TRON cüzdanından çıkan (out) hareketler varsayılan olarak Genel Kasa
-- bakiyesinden ayrı durur. Bu bayrak ile bir TRON harcaması "Genel Kasa / işletme
-- giderine de dahil" olarak işaretlenebilir; o zaman işletme bakiyesinden de düşülür.
-- Güvenli migrasyon: yeni kolon NOT NULL DEFAULT false; mevcut veri değişmez.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.kasa_transactions
  ADD COLUMN IF NOT EXISTS count_in_genel boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_kasa_transactions_count_in_genel
  ON public.kasa_transactions(count_in_genel)
  WHERE count_in_genel = true;

NOTIFY pgrst, 'reload schema';
