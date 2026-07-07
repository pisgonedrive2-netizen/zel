-- Foxstream — otomatik sistem yedekleri (veri koruma).
-- Yedekler silinmez; yalnızca service role API üzerinden okunur/yazılır.

CREATE TABLE IF NOT EXISTS public.system_backup_snapshots (
  id            text PRIMARY KEY,
  created_at    timestamptz NOT NULL DEFAULT now(),
  triggered_by  text NOT NULL DEFAULT 'cron',
  status        text NOT NULL DEFAULT 'success'
                CHECK (status IN ('success', 'partial', 'failed')),
  total_rows    int NOT NULL DEFAULT 0,
  table_count   int NOT NULL DEFAULT 0,
  table_stats   jsonb NOT NULL DEFAULT '{}',
  errors        jsonb,
  duration_ms   int
);

CREATE TABLE IF NOT EXISTS public.system_backup_table_chunks (
  id            text PRIMARY KEY,
  snapshot_id   text NOT NULL REFERENCES public.system_backup_snapshots(id) ON DELETE RESTRICT,
  table_name    text NOT NULL,
  chunk_index   int NOT NULL DEFAULT 0,
  row_count     int NOT NULL DEFAULT 0,
  data          jsonb NOT NULL DEFAULT '[]',
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (snapshot_id, table_name, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_backup_snapshots_created
  ON public.system_backup_snapshots (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_backup_chunks_snapshot
  ON public.system_backup_table_chunks (snapshot_id);

ALTER TABLE public.system_backup_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_backup_table_chunks ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.system_backup_snapshots IS
  'Zamanlanmış ve manuel tam sistem yedekleri — meta veri; satırlar asla otomatik silinmez.';
COMMENT ON TABLE public.system_backup_table_chunks IS
  'Yedek tablo verileri (JSONB parçalar); snapshot silinmeden chunk silinmez (RESTRICT).';
