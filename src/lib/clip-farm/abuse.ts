import type { ClipCreator, ClipSubmission } from "@/lib/clip-farm/types";

/** Telegram / telefon normalize — aynı kişi yeni kayıt açmasın. */
export function normalizeClipContact(raw: string): string {
  let s = raw.trim().toLowerCase();
  s = s.replace(/^https?:\/\/(t\.me|telegram\.me)\//i, "");
  s = s.replace(/^@+/, "");
  s = s.replace(/[\s()-]/g, "");
  if (/^\+?\d{10,15}$/.test(s)) {
    s = s.replace(/^\+/, "");
    if (s.startsWith("90") && s.length >= 12) s = s.slice(2);
    if (s.startsWith("0") && s.length === 11) s = s.slice(1);
  }
  return s.slice(0, 80);
}

export type CreatorRisk = {
  level: "ok" | "warn" | "high";
  labels: string[];
};

/** Admin kartında spam / tekrar gönderim sinyalleri. */
export function creatorRisk(
  creator: ClipCreator,
  submissions: ClipSubmission[],
  allCreators: ClipCreator[]
): CreatorRisk {
  const labels: string[] = [];
  const mine = submissions.filter((s) => s.creatorId === creator.id);
  const pending = mine.filter((s) => s.status === "pending").length;
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const today = mine.filter((s) => new Date(s.createdAt).getTime() >= dayAgo).length;
  const hourAgo = Date.now() - 60 * 60 * 1000;
  const lastHour = mine.filter((s) => new Date(s.createdAt).getTime() >= hourAgo).length;

  if (pending >= 20) labels.push(`${pending} bekleyen video`);
  else if (pending >= 10) labels.push("Çok bekleyen");

  if (today >= 15) labels.push(`Bugün ${today} gönderim`);
  else if (today >= 8) labels.push("Yoğun gün");

  if (lastHour >= 8) labels.push("Son 1 saatte patlama");

  const norm = creator.contactNorm || normalizeClipContact(creator.contact);
  if (norm) {
    const twins = allCreators.filter(
      (c) => c.id !== creator.id && (c.contactNorm || normalizeClipContact(c.contact)) === norm
    );
    if (twins.length > 0) labels.push(`${twins.length + 1} aynı iletişim`);
  }

  const handles = new Set(
    creator.accounts.map((a) => `${a.platform}:${a.handle.toLowerCase()}`)
  );
  const foreign = mine.filter(
    (s) =>
      s.accountHandle &&
      handles.size > 0 &&
      !handles.has(`${s.platform}:${s.accountHandle.toLowerCase()}`)
  ).length;
  if (foreign >= 3) labels.push("Bildirilmeyen hesaplardan video");

  if (creator.submitCount != null && creator.submitCount >= 40) {
    labels.push(`Toplam ${creator.submitCount} gönderim`);
  }

  const level: CreatorRisk["level"] =
    labels.some((l) => /patlama|aynı iletişim|20 bekleyen|Bugün 1[5-9]|Bugün 2/.test(l)) ||
    pending >= 20 ||
    today >= 15
      ? "high"
      : labels.length > 0
        ? "warn"
        : "ok";

  return { level, labels };
}

export const CLIP_LIMITS = {
  maxUrlsPerRequest: 10,
  maxRequestsPerIpWindow: 4,
  windowMs: 10 * 60 * 1000,
  maxPendingPerCreator: 25,
  maxPerCreatorPerDay: 20,
  maxPerIpPerHour: 30,
  maxNewCreatorsPerIpPerDay: 3,
} as const;
