"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/store/auth";
import { isSupabaseClientMode } from "@/lib/supabase-client";
import { refreshNotificationsFromServer } from "@/lib/notification-actions";
import { findPrimaryTronKasa } from "@/lib/kasa-tron-metrics";
import { useStore } from "@/store/store";

const POLL_MS = 60_000;

/**
 * Ramiz TRON cüzdanı: çıkış/giriş hem bildirim hem kasa hareketine yazılır (tron-sync).
 * İzleme adresi (tron-watch) ek bildirim üretir.
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
      const { kasas, kasaTransactions } = useStore.getState();
      const tronKasa = findPrimaryTronKasa(kasas, kasaTransactions);
      if (!tronKasa?.tronAddress) return;
      running.current = true;
      try {
        const syncRes = await fetch("/api/kasa/tron-sync", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kasaId: tronKasa.id,
            recentDays: 3,
            triggeredBy: "background-sync",
          }),
        });
        if (syncRes.ok) {
          const syncJson = (await syncRes.json()) as { imported?: number; ok?: boolean };
          if ((syncJson.imported ?? 0) > 0) {
            const boot = await fetch("/api/bootstrap", { credentials: "include", cache: "no-store" });
            if (boot.ok) {
              const data = (await boot.json()) as {
                kasaTransactions?: typeof kasaTransactions;
                kasas?: typeof kasas;
              };
              if (data.kasaTransactions) {
                useStore.setState({ kasaTransactions: data.kasaTransactions });
              }
              if (data.kasas) {
                useStore.setState({ kasas: data.kasas });
              }
            }
            await refreshNotificationsFromServer();
          }
        }

        await fetch("/api/kasa/tron-watch", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recentDays: 3 }),
        });
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
  }, [user?.id, user?.role]);

  return null;
}
