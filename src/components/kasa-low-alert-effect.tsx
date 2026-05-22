"use client";

import { useEffect, useRef } from "react";
import { useStore, calcKasaBalance } from "@/store/store";
import { useAuth } from "@/store/auth";
import { isSupabaseClientMode } from "@/lib/supabase-client";
import { fmt } from "@/lib/data";

/**
 * Kasa bakiyesi yapılandırılan eşiğin altına düştüğünde günde bir
 * "kasa düşük" bildirimini yönetici ve denetçilere bırakır. Eşik,
 * `app_settings` tablosundaki `notifications.kasaLowThreshold` anahtarından
 * okunur. Supabase devre dışıysa fallback olarak 5000 USDT kullanılır.
 */
export function KasaLowAlertEffect() {
  const kasas = useStore((s) => s.kasas);
  const kasaTransactions = useStore((s) => s.kasaTransactions);
  const notifications = useStore((s) => s.notifications);
  const bootstrapReady = kasas.length > 0;
  const supabaseMode = isSupabaseClientMode();
  const user = useAuth((s) => s.user);
  const threshold = useRef(5000);
  const silenced = useRef<Set<string>>(new Set());
  const loaded = useRef(false);

  // Yalnızca admin / auditor için ayarları çek.
  useEffect(() => {
    if (!bootstrapReady) return;
    if (loaded.current) return;
    if (!user || (user.role !== "admin" && user.role !== "auditor")) return;
    if (!supabaseMode) {
      loaded.current = true;
      return;
    }
    loaded.current = true;
    void (async () => {
      try {
        const res = await fetch("/api/notifications/settings", { credentials: "include" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          settings?: {
            "notifications.kasaLowThreshold"?: number;
            "notifications.silencedTypes"?: string[];
          };
        };
        if (typeof data.settings?.["notifications.kasaLowThreshold"] === "number") {
          threshold.current = data.settings["notifications.kasaLowThreshold"];
        }
        const sil = data.settings?.["notifications.silencedTypes"];
        if (Array.isArray(sil)) {
          silenced.current = new Set(sil);
        }
      } catch {
        /* sessiz */
      }
    })();
  }, [bootstrapReady, user, supabaseMode]);

  useEffect(() => {
    if (!bootstrapReady) return;
    if (!user || (user.role !== "admin" && user.role !== "auditor")) return;
    if (silenced.current.has("kasa_low")) return;

    const balance = calcKasaBalance(kasaTransactions);
    if (balance > threshold.current) return;

    const today = new Date().toISOString().slice(0, 10);
    const refAdmin = `kasa-low-${today}-admin`;
    const refAud = `kasa-low-${today}-auditor`;
    const has = (refId: string, role: "admin" | "auditor") =>
      notifications.some((n) => n.type === "kasa_low" && n.forRole === role && n.refId === refId);

    const { pushNotification } = useStore.getState();
    const msg = `Kasa bakiyesi düşük: ${fmt(balance)} (eşik ${fmt(threshold.current)}). Lütfen kasayı kontrol edin.`;

    if (!has(refAdmin, "admin")) {
      pushNotification({
        type: "kasa_low",
        title: "⚠ Kasa düşük bakiye uyarısı",
        message: msg,
        forRole: "admin",
        href: "/kasa",
        refId: refAdmin,
      });
    }
    if (!has(refAud, "auditor")) {
      pushNotification({
        type: "kasa_low",
        title: "⚠ Kasa düşük bakiye uyarısı",
        message: msg,
        forRole: "auditor",
        href: "/kasa",
        refId: refAud,
      });
    }
  }, [bootstrapReady, user, kasaTransactions, notifications]);

  return null;
}
