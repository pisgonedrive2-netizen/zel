/**
 * Toplu yenileme işlemleri için basit in-memory job state.
 *
 * Vercel function instance'ları arasında paylaşılmaz; ancak tek tek istek
 * süresince UI'a "şu an çalışıyor / X tamamlandı" bilgisi vermek için yeterli
 * (bir instance'ta başlayan iş, polling sırasında genellikle aynı instance'a
 * yönlendirilir; değilse "active" görünmez ve UI sadece sonuç döner).
 *
 * Daha sağlam bir çözüm için `api_refresh_runs` tablosu zaten kalıcı durumu
 * (started_at / finished_at / attempted / succeeded / failed) saklıyor.
 */

import type { BulkRefreshSummary } from "./refresh-runner";

export type BulkRefreshJobMode = "all" | "failed-only" | "selected";

export interface BulkRefreshJobState {
  id: string;
  status: "running" | "completed" | "error";
  mode: BulkRefreshJobMode;
  brandId?: string;
  targetDate?: string;
  userId?: string;
  startedAt: string;
  finishedAt?: string;
  summary?: BulkRefreshSummary;
  error?: string;
  /** Hangi linkin işlendiği (sequence — UI dilerse gösterir). */
  current?: {
    linkId: string;
    platform: string;
    handle: string;
    index: number;
    total: number;
  };
}

const jobs = new Map<string, BulkRefreshJobState>();

/** Eski/tamamlanmış işleri temizle — 1 saatten eski. */
function pruneOld() {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [id, j] of jobs) {
    const finished = j.finishedAt ? new Date(j.finishedAt).getTime() : null;
    if (finished && finished < cutoff) jobs.delete(id);
  }
}

export function startBulkRefreshJob(
  id: string,
  opts: {
    mode: BulkRefreshJobMode;
    brandId?: string;
    targetDate?: string;
    userId?: string;
  }
): BulkRefreshJobState {
  pruneOld();
  const state: BulkRefreshJobState = {
    id,
    status: "running",
    mode: opts.mode,
    brandId: opts.brandId,
    targetDate: opts.targetDate,
    userId: opts.userId,
    startedAt: new Date().toISOString(),
  };
  jobs.set(id, state);
  return state;
}

export function setBulkRefreshJobCurrent(
  id: string,
  current: BulkRefreshJobState["current"]
): void {
  const j = jobs.get(id);
  if (!j) return;
  j.current = current;
}

export function finishBulkRefreshJob(id: string, summary: BulkRefreshSummary): void {
  const j = jobs.get(id);
  if (!j) {
    jobs.set(id, {
      id,
      status: "completed",
      mode: "all",
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      summary,
    });
    return;
  }
  j.status = "completed";
  j.finishedAt = new Date().toISOString();
  j.summary = summary;
  j.current = undefined;
}

export function failBulkRefreshJob(id: string, error: string): void {
  const j = jobs.get(id);
  if (!j) {
    jobs.set(id, {
      id,
      status: "error",
      mode: "all",
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      error,
    });
    return;
  }
  j.status = "error";
  j.finishedAt = new Date().toISOString();
  j.error = error;
  j.current = undefined;
}

export function getBulkRefreshJob(id: string): BulkRefreshJobState | undefined {
  return jobs.get(id);
}

export function listRecentBulkRefreshJobs(): BulkRefreshJobState[] {
  pruneOld();
  return Array.from(jobs.values()).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
