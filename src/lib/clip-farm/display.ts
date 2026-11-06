import { fmtCompact } from "@/lib/data";

export type ClipMetricsInput = {
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares?: number | null;
  lastCheckedAt: string | null;
  lastCheckError?: string | null;
};

export type ClipMetricsDisplay = {
  text: string;
  title?: string;
  tone: "muted" | "warn" | "ok";
};

/** Klip durum / admin — izlenme satırı; hatalı ölçümde eski sayıları yanıltıcı gösterme. */
export function formatClipSubmissionMetrics(s: ClipMetricsInput): ClipMetricsDisplay {
  const hasNumbers =
    s.views != null || s.likes != null || s.comments != null || s.shares != null;
  const line = hasNumbers
    ? [
        s.views != null ? `${fmtCompact(s.views)} izlenme` : null,
        s.likes != null ? `${fmtCompact(s.likes)} beğeni` : null,
        s.comments != null ? `${fmtCompact(s.comments)} yorum` : null,
        s.shares != null && s.shares > 0 ? `${fmtCompact(s.shares)} paylaşım` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  if (s.lastCheckError?.trim()) {
    const short = s.lastCheckError.trim().slice(0, 120);
    if (line && s.lastCheckedAt) {
      return {
        text: `${line} · güncellenemedi`,
        title: short,
        tone: "warn",
      };
    }
    return {
      text: "Sayılar alınamadı — linki ve hesabın herkese açık olduğunu kontrol et.",
      title: short,
      tone: "warn",
    };
  }

  if (!s.lastCheckedAt || !line) {
    return {
      text: "Sayılar henüz çekilmedi — onay sonrası birkaç dakika sürebilir.",
      tone: "muted",
    };
  }

  return { text: line, tone: "ok" };
}
