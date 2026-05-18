"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/store/auth";
import { useStore } from "@/store/store";
import { fmt, toDateLocal, toYearMonthLocal } from "@/lib/data";
import {
  derivePaymentStatus,
  isInBrandPaymentReminderWindow,
} from "@/lib/brand-payment-schedule";
import {
  brandUsersForProject,
  buildBrandPaymentReminderCopy,
  wasReminderSentToday,
} from "@/lib/ic-gelir-remind";
import { isSupabaseClientMode } from "@/lib/supabase-client";
import { payrollMonthLongTitle } from "@/lib/payroll-dates";

/**
 * İç gelir projelerinde ödeme penceresi yaklaşınca marka portalı hesaplarına
 * (ve özette yöneticiye) günde bir hatırlatma bildirimi.
 */
export function BrandPaymentReminderEffect() {
  const projects = useStore((s) => s.projects);
  const projectPayments = useStore((s) => s.projectPayments);
  const brands = useStore((s) => s.brands);
  const users = useAuth((s) => s.users);
  const user = useAuth((s) => s.user);
  const silenced = useRef<Set<string>>(new Set());
  const settingsLoaded = useRef(false);

  useEffect(() => {
    if (settingsLoaded.current) return;
    if (!user || user.role !== "admin") return;
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
          settings?: { "notifications.silencedTypes"?: string[] };
        };
        const sil = data.settings?.["notifications.silencedTypes"];
        if (Array.isArray(sil)) silenced.current = new Set(sil);
      } catch {
        /* sessiz */
      }
    })();
  }, [user]);

  useEffect(() => {
    if (user?.role !== "admin") return;
    if (silenced.current.has("brand_payment_reminder")) return;

    const today = new Date();
    const ym = toYearMonthLocal(today);
    const day = toDateLocal(today);

    const dueProjects = projects.filter((p) => {
      if (p.status === "paused" || !p.brandId || !p.paymentDay?.trim()) return false;
      if (p.reminderEnabled === false) return false;
      if (wasReminderSentToday(p.lastReminderSentAt, today)) return false;
      if (!isInBrandPaymentReminderWindow(p.paymentDay, ym, today, p.reminderDaysBefore ?? 3)) {
        return false;
      }
      const pay = projectPayments.find((x) => x.projectId === p.id && x.month === ym);
      const status = derivePaymentStatus(pay?.status ?? "pending", ym, p.paymentDay, today);
      return status !== "paid" && status !== "cancelled";
    });

    if (dueProjects.length === 0) return;

    const { pushNotification } = useStore.getState();
    const refAdmin = `brand-pay-due-${ym}-${day}-admin`;

    const hasReminder = (refId: string, role: "admin" | "brand", forUserId?: string) =>
      useStore.getState().notifications.some(
        (n) =>
          n.type === "brand_payment_reminder" &&
          n.forRole === role &&
          n.refId === refId &&
          (!forUserId || n.forUserId === forUserId)
      );

    if (!hasReminder(refAdmin, "admin")) {
      const names = dueProjects
        .map((p) => brands.find((b) => b.id === p.brandId)?.shortName ?? p.name)
        .join(", ");
      const toplam = dueProjects.reduce((s, p) => s + p.monthlyRevenue, 0);
      pushNotification({
        type: "brand_payment_reminder",
        title: `Marka ödemeleri yaklaşıyor · ${payrollMonthLongTitle(ym)}`,
        message:
          `${dueProjects.length} iç gelir kaydı için tahsilat penceresi açık (${names}). ` +
          `Toplam beklenen: ${fmt(toplam)}. İç Gelir sayfasından markalara hatırlatma gönderebilirsiniz.`,
        forRole: "admin",
        href: "/ic-gelir",
        refId: refAdmin,
      });
    }

    for (const p of dueProjects) {
      const brand = brands.find((b) => b.id === p.brandId);
      const { title, message, refId: refBase } = buildBrandPaymentReminderCopy(p, brand, ym);
      const brandAccounts = brandUsersForProject(users, p.brandId);

      for (const bu of brandAccounts) {
        const refBrand = `${refBase}-${bu.id}-${day}`;
        if (hasReminder(refBrand, "brand", bu.id)) continue;
        pushNotification({
          type: "brand_payment_reminder",
          title,
          message,
          forRole: "brand",
          forUserId: bu.id,
          href: "/marka/izlenmeler",
          refId: refBrand,
        });
      }

      if (!wasReminderSentToday(p.lastReminderSentAt, today)) {
        useStore.getState().updateProject(p.id, {
          lastReminderSentAt: today.toISOString(),
        });
      }
    }
  }, [projects, projectPayments, brands, users, user?.role]);

  return null;
}
