-- TRON cüzdan izleme (kasa hareketlerinden bağımsız — yalnızca bildirim)
CREATE TABLE IF NOT EXISTS public.tron_watch_seen (
  tron_tx_id text PRIMARY KEY,
  direction text NOT NULL CHECK (direction IN ('in', 'out')),
  amount_usd numeric NOT NULL,
  tx_at timestamptz NOT NULL,
  wallet_address text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tron_watch_seen_tx_at
  ON public.tron_watch_seen (tx_at DESC);
