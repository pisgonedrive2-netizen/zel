import type { StreamerAccount } from "@/store/store";

const ACHIEVEMENT_SYNC_PLATFORMS = /youtube|instagram|tiktok/i;

/** Hesap eklendi/güncellendiğinde paylaşım takvimine otomatik yaz (tüm giriş noktaları). */
export function queueAchievementSyncAfterAccountChange(
  account: Pick<StreamerAccount, "employeeId" | "platform" | "status">,
): void {
  if (account.status !== "active") return;
  if (!ACHIEVEMENT_SYNC_PLATFORMS.test(account.platform)) return;

  void import("@/lib/achievement-api").then(async (api) => {
    try {
      const res = await api.syncStreamerAchievementFromAccounts(account.employeeId);
      if (res?.reels?.length) {
        api.mergeAchievementReelsIntoStore(res.reels, account.employeeId);
      }
    } catch {
      /* RapidAPI kotası veya bağlantı yoksa sessiz */
    }
  });
}
