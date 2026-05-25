import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyPin } from "@/lib/password";
import { appUserExists, upsertAppUser } from "@/lib/db/upsert-app-user";
export { upsertAppUser, appUserExists };
import type { SessionPayload } from "@/lib/session";
import type { AppHydratePayload, BrandLink } from "@/store/store";
import { ensureExpenseSubmittedNotifications } from "@/lib/expense-notify";
import { dedupeSalaryExtrasByContentExpense } from "@/lib/salary-extra-dedupe";
import { syncContentExpensesAndSalaryExtras } from "@/lib/content-expense-sync";
import type { AppUser } from "@/store/auth";
import {
  employeeFromRow, employeeToRow, advanceFromRow, advanceToRow,
  salaryExtraFromRow, salaryExtraToRow, paymentStatusFromRow, paymentStatusToRow,
  companyFromRow, companyToRow, sponsorTxFromRow, sponsorTxToRow,
  projectFromRow, projectToRow, projectPaymentFromRow, projectPaymentToRow, expenseEntryFromRow, expenseEntryToRow,
  plannedFromRow, plannedToRow, plannedPaymentFromRow, plannedPaymentToRow, streamerAccountFromRow, streamerAccountToRow,
  scheduleSlotFromRow, scheduleSlotToRow, brandFromRow, brandToRow,
  brandLinkFromRow, brandLinkToRow, linkSnapshotFromRow, linkSnapshotToRow,
  viewershipFromRow, viewershipToRow,
  brandMonthlyStatsFromRow, brandMonthlyStatsToRow,
  kasaAccountFromRow, kasaAccountToRow, kasaFromRow, kasaToRow,
  contentExpenseFromRow, contentExpenseToRow, weeklyPlanFromRow, weeklyPlanToRow,
  weekBrandReelFromRow, weekBrandReelToRow, notificationFromRow, notificationToRow,
  appUserFromRow, appUserToRow,
} from "@/lib/db/mappers";

type Rows = Record<string, unknown>[];

async function selectAll<T>(table: string, map: (r: Record<string, unknown>) => T): Promise<T[]> {
  const { data, error } = await getSupabaseAdmin().from(table).select("*");
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data ?? []).map((r) => map(r as Record<string, unknown>));
}

async function upsertRows(table: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  const { error } = await getSupabaseAdmin().from(table).upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`${table} upsert: ${error.message}`);
}

/** Boş URL/handle/owner ile mevcut link verisinin üzerine yazmayı engeller. */
export async function upsertBrandLinksMerged(links: BrandLink[]) {
  if (links.length === 0) return;
  const existing = await selectAll("brand_links", brandLinkFromRow);
  const byId = new Map(existing.map((l) => [l.id, l]));
  const merged = links.map((incoming) => {
    const prev = byId.get(incoming.id);
    if (!prev) return incoming;
    return {
      ...incoming,
      url: incoming.url?.trim() ? incoming.url : prev.url,
      handle: incoming.handle?.trim() ? incoming.handle : prev.handle,
      ownerId: incoming.ownerId ?? prev.ownerId,
      lastViews: incoming.lastViews ?? prev.lastViews,
      lastSnapshotDate: incoming.lastSnapshotDate ?? prev.lastSnapshotDate,
      lastLikes: incoming.lastLikes ?? prev.lastLikes,
      lastComments: incoming.lastComments ?? prev.lastComments,
      lastShares: incoming.lastShares ?? prev.lastShares,
      externalRef: incoming.externalRef ?? prev.externalRef,
      lastCheckedAt: incoming.lastCheckedAt ?? prev.lastCheckedAt,
    };
  });
  await upsertRows("brand_links", merged.map(brandLinkToRow));
}

async function deleteNotIn(table: string, ids: string[], extraFilter?: { column: string; value: string }) {
  let q = getSupabaseAdmin().from(table).select("id");
  if (extraFilter) q = q.eq(extraFilter.column, extraFilter.value);
  const { data, error } = await q;
  if (error) throw new Error(`${table} select ids: ${error.message}`);
  const existing = (data ?? []).map((r) => String((r as { id: string }).id));
  const toDelete = existing.filter((id) => !ids.includes(id));
  if (toDelete.length === 0) return;
  // Güvenlik: boş payload ile toplu silme (bootstrap hatası / eksik store) engellenir.
  if (ids.length === 0 && existing.length > 0) {
    throw new Error(
      `${table}: senkronizasyon güvenliği — boş listeyle mevcut ${existing.length} satır silinemez.`
    );
  }
  const { error: delErr } = await getSupabaseAdmin().from(table).delete().in("id", toDelete);
  if (delErr) throw new Error(`${table} delete: ${delErr.message}`);
}

/** Login — returns session payload or null. */
export async function loginUser(username: string, pin: string): Promise<SessionPayload | null> {
  const un = username.toLowerCase().trim();
  const { data, error } = await getSupabaseAdmin()
    .from("app_users")
    .select("*")
    .eq("username", un)
    .eq("active", true)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as Record<string, unknown>;
  const ok = await verifyPin(pin, String(row.pin_hash));
  if (!ok) return null;
  const now = new Date().toISOString();
  await getSupabaseAdmin().from("app_users").update({ last_login_at: now }).eq("id", row.id);
  return {
    userId: String(row.id),
    username: String(row.username),
    name: String(row.name),
    role: row.role as SessionPayload["role"],
    employeeId: row.employee_id ? String(row.employee_id) : undefined,
    brandId: row.brand_id ? String(row.brand_id) : undefined,
    avatar: String(row.avatar ?? ""),
  };
}

export async function fetchUsers(): Promise<AppUser[]> {
  return selectAll("app_users", appUserFromRow);
}

export async function fetchBootstrap(session: SessionPayload): Promise<AppHydratePayload & { users?: AppUser[] }> {
  const [
    employees, advances, salaryExtras, paymentStatuses, companies, sponsorTransactions,
    projects, projectPayments, expenses, plannedItems, plannedItemPayments, streamerAccounts, scheduleSlots, brands, brandLinks,
    linkSnapshots, brandViewership, brandMonthlyStats, kasas, kasaTransactions, contentExpenses, weeklyPlans,
    weekBrandReels, notifications,
  ] = await Promise.all([
    selectAll("employees", employeeFromRow),
    selectAll("advances", advanceFromRow),
    selectAll("salary_extras", salaryExtraFromRow),
    selectAll("payment_statuses", paymentStatusFromRow),
    selectAll("external_companies", companyFromRow),
    selectAll("sponsor_transactions", sponsorTxFromRow),
    selectAll("internal_projects", projectFromRow),
    selectAll("internal_project_payments", projectPaymentFromRow),
    selectAll("expense_entries", expenseEntryFromRow),
    selectAll("planned_items", plannedFromRow),
    selectAll("planned_item_payments", plannedPaymentFromRow),
    selectAll("streamer_accounts", streamerAccountFromRow),
    selectAll("schedule_slots", scheduleSlotFromRow),
    selectAll("brands", brandFromRow),
    selectAll("brand_links", brandLinkFromRow),
    selectAll("link_snapshots", linkSnapshotFromRow),
    selectAll("brand_viewership", viewershipFromRow),
    selectAll("brand_monthly_stats", brandMonthlyStatsFromRow),
    selectAll("kasas", kasaAccountFromRow),
    selectAll("kasa_transactions", kasaFromRow),
    selectAll("content_expenses", contentExpenseFromRow),
    selectAll("weekly_plans", weeklyPlanFromRow),
    selectAll("week_brand_reels", weekBrandReelFromRow),
    selectAll("app_notifications", notificationFromRow),
  ]);

  const payload: AppHydratePayload & { users?: AppUser[] } = {
    employees,
    advances,
    salaryExtras,
    paymentStatuses,
    companies,
    sponsorTransactions,
    projects,
    projectPayments,
    expenses,
    plannedItems,
    plannedItemPayments,
    streamerAccounts,
    scheduleSlots,
    brands,
    brandLinks,
    linkSnapshots,
    brandViewership,
    brandMonthlyStats,
    kasas,
    kasaTransactions,
    contentExpenses,
    weeklyPlans,
    weekBrandReels,
    notifications,
  };

  if (session.role === "admin" || session.role === "auditor") {
    if (session.role === "admin") {
      payload.users = await fetchUsers();
    }
    try {
      const repairedSlots = await repairMissingBrandLinkSlots();
      const repairedOrphans = await repairOrphanedBrandLinksFromSnapshots();
      if (repairedSlots > 0 || repairedOrphans > 0) {
        payload.brandLinks = await selectAll("brand_links", brandLinkFromRow);
      }
    } catch {
      /* onarım isteğe bağlı */
    }
    try {
      const { ensureTronKasaConfigured } = await import("@/lib/tron-sync");
      const genel = payload.kasas?.find((k) => k.isDefault && !k.archived) ?? payload.kasas?.[0];
      if (genel) {
        const updated = await ensureTronKasaConfigured(genel);
        if (
          updated.tronAddress !== genel.tronAddress ||
          updated.tronSyncFrom !== genel.tronSyncFrom
        ) {
          await upsertRows("kasas", [kasaAccountToRow(updated)]);
          payload.kasas = (payload.kasas ?? []).map((k) =>
            k.id === updated.id ? updated : k
          );
        }
      }
    } catch {
      /* TRON env yoksa atla */
    }
  }

  if (session.role === "streamer" && session.employeeId) {
    const eid = session.employeeId;
    const myLinks = brandLinks.filter((l) => l.ownerId === eid);
    const myLinkIds = new Set(myLinks.map((l) => l.id));
    return {
      employees: employees.filter((e) => e.id === eid),
      advances: advances.filter((a) => a.employeeId === eid),
      salaryExtras: salaryExtras.filter((s) => s.employeeId === eid),
      paymentStatuses: paymentStatuses.filter((p) => p.employeeId === eid),
      companies: [],
      sponsorTransactions: [],
      projects: [],
      projectPayments: [],
      expenses: [],
      plannedItems: [],
      plannedItemPayments: [],
      streamerAccounts: streamerAccounts.filter((a) => a.employeeId === eid),
      scheduleSlots: scheduleSlots.filter((s) => s.employeeId === eid),
      brands: brands.filter((b) => b.status === "active"),
      brandLinks: myLinks,
      linkSnapshots: linkSnapshots.filter((s) => myLinkIds.has(s.linkId)),
      brandViewership: brandViewership.filter((v) => v.employeeId === eid),
      kasas: [],
      kasaTransactions: [],
      contentExpenses: contentExpenses.filter((c) => c.employeeId === eid),
      weeklyPlans: weeklyPlans.filter((p) => p.employeeId === eid),
      weekBrandReels: weekBrandReels.filter((r) => r.employeeId === eid),
      notifications: notifications.filter(
        (n) =>
          n.forRole === "streamer" &&
          (!n.forUserId || n.forUserId === session.userId)
      ),
    };
  }

  if (session.role === "brand" && session.brandId) {
    const bid = session.brandId;
    // Markaya ait planlı kalemler ve onların taksitleri
    const myPlannedItems = plannedItems.filter((p) => p.brandId === bid);
    const myPlannedItemIds = new Set(myPlannedItems.map((p) => p.id));
    const myPlannedItemPayments = plannedItemPayments.filter((pp) =>
      myPlannedItemIds.has(pp.plannedItemId)
    );
    // Marka takviminde / izlenmelerinde yayıncı adı görmek için aktif yayıncı/moderatörler
    const visibleEmployees = employees.filter(
      (e) => e.kind === "streamer" || e.kind === "moderator"
    );
    return {
      employees: visibleEmployees,
      advances: [],
      salaryExtras: [],
      paymentStatuses: [],
      companies: [],
      sponsorTransactions: [],
      projects: [],
      projectPayments: [],
      expenses: expenses.filter((e) => e.brandId === bid),
      plannedItems: myPlannedItems,
      plannedItemPayments: myPlannedItemPayments,
      streamerAccounts: [],
      scheduleSlots,
      brands: brands.filter((b) => b.id === bid),
      brandLinks: brandLinks.filter((l) => l.brandId === bid),
      linkSnapshots: linkSnapshots.filter((s) =>
        brandLinks.some((l) => l.id === s.linkId && l.brandId === bid)
      ),
      brandViewership: brandViewership.filter((v) => v.brandId === bid),
      brandMonthlyStats: brandMonthlyStats.filter((s) => s.brandId === bid),
      kasas: [],
      kasaTransactions: [],
      contentExpenses: contentExpenses.filter((c) => c.brandId === bid),
      weeklyPlans: [],
      weekBrandReels: weekBrandReels.filter((r) => r.brandId === bid),
      notifications: notifications.filter(
        (n) => n.forRole === "brand" && (!n.forUserId || n.forUserId === session.userId)
      ),
    };
  }

  return payload;
}

/** Full replace for admin; scoped upsert for streamer/auditor. */
export async function syncAppData(
  session: SessionPayload,
  payload: AppHydratePayload
): Promise<void> {
  if (session.role === "auditor") {
    await syncAuditorScoped(payload);
    return;
  }

  if (session.role === "streamer") {
    if (!session.employeeId) throw new Error("Yayıncı employee_id eksik.");
    await syncStreamerScoped(session.employeeId, payload);
    return;
  }

  if (session.role === "brand") {
    if (!session.brandId) throw new Error("Marka brand_id eksik.");
    await syncBrandScoped(session.brandId, payload);
    return;
  }

  if (session.role !== "admin") {
    throw new Error("Bu rol için senkronizasyon izni yok.");
  }

  await syncAdminFull(payload);
}

async function syncBrandScoped(brandId: string, payload: AppHydratePayload) {
  // Marka yalnızca kendi brand_id'sine ait brand_monthly_stats satırını yazabilir.
  // (brand_id, month) UNIQUE olduğundan id kısıtlaması üzerinden değil bu çift üzerinden upsert ediyoruz.
  const stats = (payload.brandMonthlyStats ?? []).filter((s) => s.brandId === brandId);
  if (stats.length === 0) return;
  const rows = stats.map(brandMonthlyStatsToRow);
  const { error } = await getSupabaseAdmin()
    .from("brand_monthly_stats")
    .upsert(rows, { onConflict: "brand_id,month" });
  if (error) throw new Error(`brand_monthly_stats: ${error.message}`);
}

async function syncAuditorScoped(payload: AppHydratePayload) {
  // Denetçi yalnızca inceleme/audit sonucunu kalıcılaştırabilir; kayıt silme yok.
  const expenses = payload.contentExpenses ?? [];
  if (expenses.length > 0) {
    await syncContentExpensesAndSalaryExtras(expenses, []);
  }
  const notifications = (payload.notifications ?? []).filter((n) =>
    n.forRole === "streamer" || n.forRole === "admin" || n.forRole === "auditor"
  );
  if (notifications.length > 0) {
    await upsertRows("app_notifications", notifications.map(notificationToRow));
  }
}

async function syncAdminFull(payload: AppHydratePayload) {
  const salaryExtrasDeduped = dedupeSalaryExtrasByContentExpense(
    payload.salaryExtras ?? [],
    payload.contentExpenses ?? []
  );
  const payloadDeduped: AppHydratePayload = {
    ...payload,
    salaryExtras: salaryExtrasDeduped,
  };

  const tables: Array<{
    table: string;
    rows: Record<string, unknown>[];
    skipDelete?: boolean;
    mergeUpsert?: boolean;
  }> = [
    { table: "employees", rows: (payload.employees ?? []).map(employeeToRow) },
    { table: "brands", rows: (payload.brands ?? []).map(brandToRow), skipDelete: true },
    { table: "external_companies", rows: (payload.companies ?? []).map(companyToRow) },
    { table: "advances", rows: (payload.advances ?? []).map(advanceToRow) },
    { table: "sponsor_transactions", rows: (payload.sponsorTransactions ?? []).map(sponsorTxToRow) },
    { table: "internal_projects", rows: (payload.projects ?? []).map(projectToRow) },
    { table: "internal_project_payments", rows: (payload.projectPayments ?? []).map(projectPaymentToRow) },
    { table: "expense_entries", rows: (payload.expenses ?? []).map(expenseEntryToRow) },
    { table: "planned_items", rows: (payload.plannedItems ?? []).map(plannedToRow) },
    { table: "planned_item_payments", rows: (payload.plannedItemPayments ?? []).map(plannedPaymentToRow) },
    { table: "streamer_accounts", rows: (payload.streamerAccounts ?? []).map(streamerAccountToRow), skipDelete: true },
    { table: "schedule_slots", rows: (payload.scheduleSlots ?? []).map(scheduleSlotToRow), skipDelete: true },
    // Marka linkleri / snapshot / viewership asla toplu silinmez (sync eksik payload ile kayıp önlenir).
    {
      table: "brand_links",
      rows: (payload.brandLinks ?? []).map(brandLinkToRow),
      skipDelete: true,
      mergeUpsert: true,
    },
    { table: "link_snapshots", rows: (payload.linkSnapshots ?? []).map(linkSnapshotToRow), skipDelete: true },
    { table: "brand_viewership", rows: (payload.brandViewership ?? []).map(viewershipToRow), skipDelete: true },
    { table: "brand_monthly_stats", rows: (payload.brandMonthlyStats ?? []).map(brandMonthlyStatsToRow) },
    // Kasa hesapları kasa_transactions FK referansı; önce hesaplar upsert edilmeli.
    // deleteNotIn yapmıyoruz: kullanıcı yanlışlıkla bağlı hareketleri olan
    // bir kasayı silerse FK RESTRICT hata fırlatır. Bunun yerine `archived`
    // bayrağıyla yönetiyoruz.
    { table: "kasas", rows: (payload.kasas ?? []).map(kasaAccountToRow), skipDelete: true },
    // Kasa hareketleri tek tek API ile de yazılır; toplu silme yapılmaz (veri kaybı önlenir).
    { table: "kasa_transactions", rows: (payload.kasaTransactions ?? []).map(kasaToRow), skipDelete: true },
    { table: "weekly_plans", rows: (payload.weeklyPlans ?? []).map(weeklyPlanToRow), skipDelete: true },
    { table: "week_brand_reels", rows: (payload.weekBrandReels ?? []).map(weekBrandReelToRow), skipDelete: true },
    { table: "app_notifications", rows: (payload.notifications ?? []).map(notificationToRow) },
  ];

  for (const { table, rows, skipDelete, mergeUpsert } of tables) {
    if (mergeUpsert && table === "brand_links") {
      await upsertBrandLinksMerged((payload.brandLinks ?? []) as BrandLink[]);
    } else {
      await upsertRows(table, rows);
    }
    if (!skipDelete && rows.length > 0) {
      await deleteNotIn(table, rows.map((r) => String(r.id)));
    }
  }

  await syncContentExpensesAndSalaryExtras(
    payloadDeduped.contentExpenses ?? [],
    payloadDeduped.salaryExtras ?? []
  );

  const ps = (payload.paymentStatuses ?? []).map(paymentStatusToRow);
  if (ps.length > 0) {
    const { error } = await getSupabaseAdmin()
      .from("payment_statuses")
      .upsert(ps, { onConflict: "employee_id,month" });
    if (error) throw new Error(`payment_statuses: ${error.message}`);
  }
}

async function syncStreamerScoped(employeeId: string, payload: AppHydratePayload) {
  const expenses = (payload.contentExpenses ?? []).filter((e) => e.employeeId === employeeId);
  if (expenses.length > 0) {
    await syncContentExpensesAndSalaryExtras(expenses, []);
  }

  const empName =
    payload.employees?.find((e) => e.id === employeeId)?.name ?? "Yayıncı";
  for (const exp of expenses) {
    if (exp.reviewStatus === "pending" && exp.submittedAt) {
      try {
        await ensureExpenseSubmittedNotifications({
          expenseId: exp.id,
          employeeName: empName,
          brandName: exp.brandName,
          category: exp.category,
          amountUsd: exp.amountUsd,
          description: exp.description,
          month: exp.month,
          triggeredBy: exp.submittedBy,
        });
      } catch {
        /* sync akışını kesme */
      }
    }
  }

  const plans = (payload.weeklyPlans ?? []).filter((p) => p.employeeId === employeeId);
  if (plans.length > 0) {
    await upsertRows("weekly_plans", plans.map(weeklyPlanToRow));
  }

  const reels = (payload.weekBrandReels ?? []).filter((r) => r.employeeId === employeeId);
  if (reels.length > 0) {
    await upsertRows("week_brand_reels", reels.map(weekBrandReelToRow));
  }

  const accounts = (payload.streamerAccounts ?? []).filter((a) => a.employeeId === employeeId);
  if (accounts.length > 0) {
    await upsertRows("streamer_accounts", accounts.map(streamerAccountToRow));
  }

  // Bildirimler yalnızca sunucu/API ile yazılır — yayıncı sync ile üzerine yazmaz.

  const links = (payload.brandLinks ?? []).filter((l) => l.ownerId === employeeId);
  if (links.length > 0) {
    await upsertBrandLinksMerged(links);
  }
  // Yayıncı linkleri silinmez — boş sync veya eksik liste veri kaybına yol açmasın.

  const linkIds = new Set(links.map((l) => l.id));
  const snaps = (payload.linkSnapshots ?? []).filter((s) => linkIds.has(s.linkId));
  if (snaps.length > 0) {
    await upsertRows("link_snapshots", snaps.map(linkSnapshotToRow));
  }

  const viewership = (payload.brandViewership ?? []).filter((v) => v.employeeId === employeeId);
  if (viewership.length > 0) {
    await upsertRows("brand_viewership", viewership.map(viewershipToRow));
  }
}

export async function deleteAppUser(id: string) {
  const { error } = await getSupabaseAdmin().from("app_users").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

const BRAND_LINK_PLATFORMS = ["Instagram", "Kick", "TikTok", "YouTube"] as const;

/** Silinen marka slotlarını yeniden oluşturur; mevcut linklere dokunmaz. */
export async function repairMissingBrandLinkSlots(): Promise<number> {
  const brands = await selectAll("brands", brandFromRow);
  const links = await selectAll("brand_links", brandLinkFromRow);
  const slotKey = (brandId: string, platform: string) =>
    `${brandId}|${platform.toLowerCase()}`;
  const existing = new Set(links.map((l) => slotKey(l.brandId, l.platform)));
  const rows: Record<string, unknown>[] = [];

  for (const b of brands) {
    if (b.status === "inactive") continue;
    for (const platform of BRAND_LINK_PLATFORMS) {
      if (existing.has(slotKey(b.id, platform))) continue;
      rows.push(
        brandLinkToRow({
          id: `bl-${b.id}-${platform.toLowerCase()}`,
          brandId: b.id,
          platform,
          handle: "",
          url: "",
          status: "active",
          notes: "Otomatik slot (eksik kayıt onarımı)",
          autoTrack: true,
        })
      );
    }
  }

  if (rows.length > 0) await upsertRows("brand_links", rows);
  return rows.length;
}

/** Snapshot'ı olan ama link kaydı silinmiş satırları minimal slot olarak geri yükler. */
export async function repairOrphanedBrandLinksFromSnapshots(): Promise<number> {
  const links = await selectAll("brand_links", brandLinkFromRow);
  const linkIds = new Set(links.map((l) => l.id));
  const brands = await selectAll("brands", brandFromRow);
  const brandById = new Map(brands.map((b) => [b.id, b]));
  const snaps = await selectAll("link_snapshots", linkSnapshotFromRow);
  const orphanIds = [...new Set(snaps.map((s) => s.linkId))].filter((id) => !linkIds.has(id));
  if (orphanIds.length === 0) return 0;

  const rows: Record<string, unknown>[] = [];
  for (const id of orphanIds) {
    const m = /^bl-(.+?)-(instagram|kick|tiktok|youtube)$/i.exec(id);
    const brandId = m?.[1];
    const platformRaw = m?.[2]?.toLowerCase();
    const platformMap: Record<string, string> = {
      instagram: "Instagram",
      kick: "Kick",
      tiktok: "TikTok",
      youtube: "YouTube",
    };
    const platform = platformRaw ? (platformMap[platformRaw] ?? "Instagram") : "Instagram";
    if (brandId && !brandById.has(brandId)) continue;
    rows.push(
      brandLinkToRow({
        id,
        brandId: brandId ?? brands[0]?.id ?? "br-gala",
        platform: platform === "Tiktok" ? "TikTok" : platform,
        handle: "",
        url: "",
        status: "active",
        notes: "Snapshot'tan geri yüklenen link (onarım)",
        autoTrack: true,
      })
    );
  }
  if (rows.length > 0) await upsertRows("brand_links", rows);
  return rows.length;
}

export async function countAppUsers(): Promise<number> {
  const { count, error } = await getSupabaseAdmin()
    .from("app_users")
    .select("*", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export function pickSnapshot(state: Record<string, unknown>): AppHydratePayload {
  const out: AppHydratePayload = {};
  for (const k of [
    "employees", "advances", "salaryExtras", "paymentStatuses", "companies",
    "sponsorTransactions", "projects", "projectPayments", "expenses", "plannedItems", "plannedItemPayments",
    "streamerAccounts",
    "scheduleSlots", "brands", "brandLinks", "linkSnapshots", "brandViewership", "brandMonthlyStats",
    "kasas", "kasaTransactions", "contentExpenses", "weeklyPlans", "weekBrandReels", "notifications",
  ] as const) {
    if (state[k] !== undefined) (out as Record<string, unknown>)[k] = state[k];
  }
  return out;
}
