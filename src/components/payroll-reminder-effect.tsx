"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/store/auth";
import { useStore, calcNetPayable, isPayrollActive } from "@/store/store";
import { fmt, toDateLocal, toYearMonthLocal } from "@/lib/data";
import { isInPayrollReminderWindow, payrollMonthLongTitle } from "@/lib/payroll-dates";
import { isSupabaseClientMode } from "@/lib/supabase-client";

/**
 * Yaklaşan / süren maaş ödeme penceresinde, ödenmemiş bordrolar için
 * tüm yönetici (admin) ve denetçi hesaplarına günde bir bildirim.
 * Yeni admin eklendiğinde ek kod gerekmez — hedef `forRole` ile belirlenir.
 */
export function PayrollReminderEffect() {
  const employees        = useStore((s) => s.employees);
  const advances         = useStore((s) => s.advances);
  const salaryExtras     = useStore((s) => s.salaryExtras);
  const paymentStatuses  = useStore((s) => s.paymentStatuses);
  const enabled          = useRef(true);
  const daysBefore       = useRef(3);
  const silenced         = useRef<Set<string>>(new Set());
  const settingsLoaded   = useRef(false);

  useEffect(() => {
    if (settingsLoaded.current) return;
    if (!isSupabaseClientMode()) {
      settingsLoaded.current = true;
      return;
    }
    settingsLoaded.current = true;
    void (async () => {
      try {
        const res = await fetch("/api/notifications/settings", { credentials: "include" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          settings?: {
            "notifications.payrollReminderEnabled"?: boolean;
            "notifications.payrollReminderDaysBefore"?: number;
            "notifications.silencedTypes"?: string[];
          };
        };
        if (typeof data.settings?.["notifications.payrollReminderEnabled"] === "boolean") {
          enabled.current = data.settings["notifications.payrollReminderEnabled"];
        }
        const db = data.settings?.["notifications.payrollReminderDaysBefore"];
        if (typeof db === "number" && Number.isFinite(db)) {
          daysBefore.current = Math.max(0, Math.min(db, 30));
        }
        const sil = data.settings?.["notifications.silencedTypes"];
        if (Array.isArray(sil)) silenced.current = new Set(sil);
      } catch {
        /* sessiz */
      }
    })();
  }, []);

  useEffect(() => {
    if (!enabled.current) return;
    if (silenced.current.has("payroll_reminder")) return;
    const today = new Date();
    const ym    = toYearMonthLocal(today);
    const day   = toDateLocal(today);

    const bordrolu = employees.filter((e) => e.kind !== "coordinator" && e.status === "active");
    const bekleyen = bordrolu.filter((e) => {
      if (!isPayrollActive(e, ym)) return false;
      const paid = paymentStatuses.find((p) => p.employeeId === e.id && p.month === ym && p.paid);
      if (paid) return false;
      return isInPayrollReminderWindow(ym, e.paymentDay, today, daysBefore.current);
    });

    if (bekleyen.length === 0) return;

    const { pushNotification } = useStore.getState();

    const toplam = bekleyen.reduce(
      (s, e) => s + calcNetPayable(e, ym, advances, salaryExtras, paymentStatuses),
      0
    );

    const ayAd = payrollMonthLongTitle(ym);
    const isimler = bekleyen.map((e) => e.name.split(" ")[0]).join(", ");
    const msg =
      `${ayAd} bordrosu · ${bekleyen.length} çalışan ödenmedi (${isimler}) · toplam ${fmt(toplam)}. ` +
      `Tutarlar bu aya aittir; ödeme günü çalışanlara göre 1–5 veya 17. gün vb. Maaşlar sayfasından işaretleyin.`;

    const refAdmin = `payroll-due-${ym}-${day}-admin`;
    const refAud   = `payroll-due-${ym}-${day}-auditor`;

    const hasReminder = (refId: string, role: "admin" | "auditor") =>
      useStore.getState().notifications.some(
        (n) =>
          n.type === "payroll_reminder" &&
          n.forRole === role &&
          n.refId === refId
      );

    const neededAdmin = !hasReminder(refAdmin, "admin");
    const neededAud   = !hasReminder(refAud, "auditor");

    if (neededAdmin) {
      pushNotification({
        type: "payroll_reminder",
        title: `Yaklaşan maaş ödemeleri · ${ayAd}`,
        message: msg,
        forRole: "admin",
        href: "/maaslar",
        refId: refAdmin,
      });
    }
    if (neededAud) {
      pushNotification({
        type: "payroll_reminder",
        title: `Yaklaşan maaş ödemeleri · ${ayAd}`,
        message: msg,
        forRole: "auditor",
        href: "/maaslar",
        refId: refAud,
      });
    }

    try {
      const session = useAuth.getState().user;
      if (
        typeof window !== "undefined" &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted" &&
        session &&
        (session.role === "admin" || session.role === "auditor")
      ) {
        const refId = session.role === "admin" ? refAdmin : refAud;
        const osKey = `payroll-native-shown-${refId}`;
        const needed = session.role === "admin" ? neededAdmin : neededAud;
        if (needed && !sessionStorage.getItem(osKey)) {
          sessionStorage.setItem(osKey, "1");
          new Notification(`Yaklaşan maaş ödemeleri · ${ayAd}`, {
            body: msg.slice(0, 240),
            tag: `payroll-native-${ym}-${day}-${session.role}`,
          });
        }
      }
    } catch {
      /* tarayıcı bildirimi opsiyonel */
    }
  }, [employees, advances, salaryExtras, paymentStatuses]);

  return null;
}
