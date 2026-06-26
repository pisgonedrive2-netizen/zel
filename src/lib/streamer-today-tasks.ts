import type { AppNotification } from "@/store/store";

const TASK_TITLE_RE = /bugünkü görev|görev hatırlatması/i;

/** Admin atadığı günlük görev bildirimleri (tam görev panosu yok). */
export function isStreamerTaskNotification(n: AppNotification): boolean {
  if (n.type === "general" && TASK_TITLE_RE.test(n.title)) return true;
  if (n.type === "schedule_updated" && TASK_TITLE_RE.test(n.title)) return true;
  return false;
}

export function streamerTodayTasks(
  notifications: AppNotification[],
  userId: string,
  todayKey = new Date().toISOString().slice(0, 10)
): AppNotification[] {
  return notifications
    .filter((n) => n.forUserId === userId && isStreamerTaskNotification(n))
    .filter((n) => {
      const msg = n.message ?? "";
      if (msg.includes(`Son tarih: ${todayKey}`)) return true;
      if (n.title.toLowerCase().includes("bugün")) return true;
      if (n.createdAt.slice(0, 10) === todayKey) return true;
      return !n.read;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
