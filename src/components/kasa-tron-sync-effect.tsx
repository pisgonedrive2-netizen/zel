"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/store/auth";
import { isSupabaseClientMode } from "@/lib/supabase-client";
import { refreshNotificationsFromServer } from "@/lib/notification-actions";
import { findPrimaryTronKasa } from "@/lib/kasa-tron-metrics";
import {
  TRON_BACKGROUND_POLL_MS,
  TRON_BACKGROUND_RECENT_DAYS,
} from "@/lib/tron-grid-config";
import { useStore } from "@/store/store";

/**
 * TRON cüzdan: kasa hareketine yaz + bildirim (5 dk aralık, son 7 gün tarama).
 */
export function KasaTronSyncEffect() {
  const user = useAuth((s) => s.user);
  const running = useRef(false);
  const failUntil = useRef(0);

  useEffect(() => {
    if (!isSupabaseClientMode()) return;
    if (!user || (user.role !== "admin" && user.role !== "auditor")) return;

    const run = async () => {
      if (running.current) return;
      if (document.visibilityState === "hidden") return;
      if (Date.now() < failUntil.current) return;
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
            tronAddress: tronKasa.tronAddress,
            recentDays: TRON_BACKGROUND_RECENT_DAYS,
            triggeredBy: "background-sync",
          }),
        });
        if (!syncRes.ok) {
          const errJson = (await syncRes.json().catch(() => ({}))) as { error?: string };
          console.warn(
            "[tron-sync] arka plan:",
            errJson.error ?? `HTTP ${syncRes.status}`
          );
          failUntil.current = Date.now() + 15 * 60 * 1000;
          return;
        }
        failUntil.current = 0;
        const syncJson = (await syncRes.json()) as { imported?: number; ok?: boolean };
        if ((syncJson.imported ?? 0) > 0) {
          const boot = await fetch("/api/bootstrap", {
            credentials: "include",
            cache: "no-store",
          });
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

        await fetch("/api/kasa/tron-watch", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recentDays: TRON_BACKGROUND_RECENT_DAYS }),
        });
      } catch {
        /* sessiz */
      } finally {
        running.current = false;
      }
    };

    void run();
    const id = window.setInterval(() => void run(), TRON_BACKGROUND_POLL_MS);
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
