import type { SocialPlatform } from "./config";

export type ApiHealthStatus = "ok" | "warn" | "error" | "exhausted" | "unknown";

export interface ApiHealthPlatformBrief {
  platform: SocialPlatform | string;
  label: string;
  batchSizePerRun: number;
  health: {
    status: ApiHealthStatus;
    connectivityStatus?: ApiHealthStatus | "ok" | "warn" | "error" | "unknown";
    linksWithError?: number;
    throttledLinks?: number;
    staleTrackedLinks?: number;
    trackedLinkCount?: number;
    lastError?: string | null;
    successCount24h?: number;
    errorCount24h?: number;
  } | null;
}

const STATUS_ORDER: ApiHealthStatus[] = ["exhausted", "error", "warn", "unknown", "ok"];

/** Takip linklerinde gerçek bakım ihtiyacı (geçici throttle hariç). */
export function linkMaintenanceConcern(args: {
  tracked: number;
  linksWithError: number;
  staleTrackedLinks: number;
}): boolean {
  const { tracked, linksWithError, staleTrackedLinks } = args;
  if (linksWithError > 0) return true;
  if (tracked === 0) return false;
  if (staleTrackedLinks >= 8) return true;
  return staleTrackedLinks >= 3 && staleTrackedLinks / tracked >= 0.5;
}

/** Küçük API çipi: bağlantı + kota + kalıcı link hatası (eski link sayısı hariç). */
export function worstApiChipStatus(platforms: ApiHealthPlatformBrief[]): ApiHealthStatus {
  if (platforms.some((p) => p.batchSizePerRun === 0)) return "exhausted";

  let connWorst: ApiHealthStatus = "ok";
  const connOrder: ApiHealthStatus[] = ["error", "warn", "unknown", "ok"];
  for (const p of platforms) {
    const c = (p.health?.connectivityStatus ?? "unknown") as ApiHealthStatus;
    if (connOrder.indexOf(c) < connOrder.indexOf(connWorst)) connWorst = c;
  }
  if (connWorst === "error") return "error";
  if (connWorst === "warn") return "warn";

  if (platforms.every((p) => p.health?.connectivityStatus === "ok")) return "ok";
  return connWorst === "unknown" ? "unknown" : "ok";
}

export function buildPlatformWarnReasons(p: ApiHealthPlatformBrief): string[] {
  const reasons: string[] = [];
  const h = p.health;
  if (!h) return reasons;
  if (p.batchSizePerRun === 0) reasons.push("Aylık kota tükendi");
  if (h.connectivityStatus === "warn") reasons.push("API bağlantısı yanıt vermiyor");
  if (h.connectivityStatus === "error") reasons.push("API bağlantı hatası");
  if ((h.linksWithError ?? 0) > 0) reasons.push(`${h.linksWithError} link kalıcı hata`);
  if ((h.throttledLinks ?? 0) > 0) reasons.push(`${h.throttledLinks} link geçici hız limiti`);
  if ((h.staleTrackedLinks ?? 0) > 0) {
    reasons.push(`${h.staleTrackedLinks} link 24 saatten eski (cron/yenileme gerekir)`);
  }
  if ((h.errorCount24h ?? 0) > 0 && (h.successCount24h ?? 0) === 0) {
    reasons.push("Son 24 saatte yenileme tamamen başarısız");
  }
  return reasons;
}

export function worstApiHealthStatus(platforms: ApiHealthPlatformBrief[]): ApiHealthStatus {
  let best: ApiHealthStatus = "ok";
  for (const p of platforms) {
    const s =
      p.batchSizePerRun === 0
        ? "exhausted"
        : (p.health?.status ?? "unknown");
    if (STATUS_ORDER.indexOf(s) < STATUS_ORDER.indexOf(best)) best = s;
  }
  return best;
}

export function formatApiHealthSummary(
  platforms: ApiHealthPlatformBrief[],
  worst: ApiHealthStatus,
  opts?: { chip?: boolean }
): string {
  if (worst === "ok") {
    const staleTotal = platforms.reduce((s, p) => s + (p.health?.staleTrackedLinks ?? 0), 0);
    const linkErrTotal = platforms.reduce((s, p) => s + (p.health?.linksWithError ?? 0), 0);
    if (opts?.chip) {
      const hints: string[] = [];
      if (linkErrTotal > 0) hints.push(`${linkErrTotal} link hatası`);
      if (staleTotal > 0) hints.push(`${staleTotal} link yenileme bekliyor`);
      if (hints.length > 0) return `API çalışıyor · ${hints.join(" · ")}`;
    }
    return "Tüm API'lar çalışıyor";
  }

  const exhausted = platforms.filter((p) => p.batchSizePerRun === 0);
  if (worst === "exhausted" && exhausted.length > 0) {
    return `${exhausted.map((p) => p.label).join(", ")} kotası doldu`;
  }

  const errored = platforms.filter(
    (p) =>
      p.batchSizePerRun > 0 &&
      (p.health?.status === "error" ||
        ((p.health?.errorCount24h ?? 0) > 0 && (p.health?.successCount24h ?? 0) === 0))
  );
  if (worst === "error" && errored.length > 0) {
    return `${errored.map((p) => p.label).join(", ")} hata veriyor`;
  }

  const details: string[] = [];
  for (const p of platforms) {
    const h = p.health;
    if (!h || p.batchSizePerRun === 0) continue;
    if ((h.linksWithError ?? 0) > 0) {
      details.push(`${p.label}: ${h.linksWithError} link hatası`);
      continue;
    }
    if (h.connectivityStatus === "warn") {
      details.push(`${p.label}: bağlantı uyarısı`);
      continue;
    }
    if ((h.staleTrackedLinks ?? 0) > 0) {
      details.push(`${p.label}: ${h.staleTrackedLinks} link 24s+ eski`);
      continue;
    }
    if ((h.throttledLinks ?? 0) > 0) {
      details.push(`${p.label}: geçici hız limiti`);
    }
  }

  if (details.length > 0) return details.slice(0, 2).join(" · ");
  if (worst === "unknown") return "API durumu bilinmiyor — /izlenme/api'den ping atın";
  return "API'lar uyarı veriyor";
}
