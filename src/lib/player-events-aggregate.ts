import type { BrandPlayerEvent } from "@/types/brand-igaming";

export type PlayerEventBucket = {
  key: string;
  label: string;
  registrations: number;
  ftd: number;
  depositCount: number;
  depositAmount: number;
  withdrawalCount: number;
  withdrawalAmount: number;
};

function weekStartMonday(isoDate: string): string {
  const d = new Date(isoDate + "T12:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function bucketLabel(key: string, mode: "daily" | "weekly"): string {
  const d = new Date(key + "T12:00:00");
  if (mode === "daily") {
    return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
  }
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  const a = d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
  const b = end.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
  return `${a} – ${b}`;
}

function emptyBucket(key: string, mode: "daily" | "weekly"): PlayerEventBucket {
  return {
    key,
    label: bucketLabel(key, mode),
    registrations: 0,
    ftd: 0,
    depositCount: 0,
    depositAmount: 0,
    withdrawalCount: 0,
    withdrawalAmount: 0,
  };
}

/** Oyuncu olaylarını günlük veya haftalık kovalara toplar. */
export function aggregatePlayerEvents(
  events: BrandPlayerEvent[],
  mode: "daily" | "weekly"
): PlayerEventBucket[] {
  const map = new Map<string, PlayerEventBucket>();

  for (const e of events) {
    const key = mode === "daily" ? e.eventDate : weekStartMonday(e.eventDate);
    const bucket = map.get(key) ?? emptyBucket(key, mode);
    switch (e.eventType) {
      case "registration":
        bucket.registrations += e.eventCount;
        break;
      case "ftd":
        bucket.ftd += e.eventCount;
        break;
      case "deposit":
        bucket.depositCount += e.eventCount;
        bucket.depositAmount += e.amount;
        break;
      case "withdrawal":
        bucket.withdrawalCount += e.eventCount;
        bucket.withdrawalAmount += e.amount;
        break;
      default:
        break;
    }
    map.set(key, bucket);
  }

  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
}

export function sumPlayerEventBuckets(buckets: PlayerEventBucket[]) {
  return buckets.reduce(
    (acc, b) => ({
      registrations: acc.registrations + b.registrations,
      ftd: acc.ftd + b.ftd,
      depositCount: acc.depositCount + b.depositCount,
      depositAmount: acc.depositAmount + b.depositAmount,
      withdrawalCount: acc.withdrawalCount + b.withdrawalCount,
      withdrawalAmount: acc.withdrawalAmount + b.withdrawalAmount,
    }),
    {
      registrations: 0,
      ftd: 0,
      depositCount: 0,
      depositAmount: 0,
      withdrawalCount: 0,
      withdrawalAmount: 0,
    }
  );
}
