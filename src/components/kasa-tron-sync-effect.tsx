"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/store/auth";
import { isSupabaseClientMode } from "@/lib/supabase-client";
import { refreshNotificationsFromServer } from "@/lib/notification-actions";

const POLL_MS = 60_000;

/**
 * Admin/denetçi paneli açıkken izlenen TRON cüzdanını kontrol eder.
 * Kasa hareketlerine yazmaz — yalnızca giriş/çıkış bildirimi.
 */
export function KasaTronSyncEffect() {
  const user = useAuth((s) => s.user);
  const running = useRef(false);

  useEffect(() => {
    if (!isSupabaseClientMode()) return;
    if (!user || (user.role !== "admin" && user.role !== "auditor")) return;

    const run = async () => {
      if (running.current) return;
      if (document.visibilityState === "hidden") return;
      running.current = true;
      try {
        const res = await fetch("/api/kasa/tron-watch", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recentDays: 3 }),
        });
        if (!res.ok) return;
        const json = (await res.json()) as { newCount?: number; notifications?: number };
        if ((json.newCount ?? 0) > 0 || (json.notifications ?? 0) > 0) {
          await refreshNotificationsFromServer();
        }
      } catch {
        /* sessiz */
      } finally {
        running.current = false;
      }
    };

    void run();
    const id = window.setInterval(() => void run(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void run();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user]);

  return null;
}
