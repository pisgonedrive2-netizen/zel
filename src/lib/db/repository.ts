import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyPin } from "@/lib/password";
import { appUserExists, upsertAppUser } from "@/lib/db/upsert-app-user";
export { upsertAppUser, appUserExists };
import type { SessionPayload } from "@/lib/session";
import type { AppHydratePayload } from "@/store/store";
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

async function deleteNotIn(table: string, ids: string[], extraFilter?: { column: string; value: string }) {
  let q = getSupabaseAdmin().from(table).select("id");
  if (extraFilter) q = q.eq(extraFilter.column, extraFilter.value);
  const { data, error } = await q;
  if (error) throw new Error(`${table} select ids: ${error.message}`);
  const existing = (data ?? []).map((r) => String((r as { id: string }).id));
  const toDelete = existing.filter((id) => !ids.includes(id));
  if (toDelete.length === 0) return;
  // Güvenlik: client tarafı tüm satırları silmek isterse (boş upsert + dolu mevcut),
  // bu büyük olasılıkla bootstrap çatışması veya hatalı senkronizasyondur — engelle.
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

  if (session.role === "admin") {
    payload.users = await fetchUsers();
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
      expenses: [],
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
    await upsertRows("content_expenses", expenses.map(contentExpenseToRow));
  }
  const notifications = (payload.notifications ?? []).filter((n) =>
    n.forRole === "streamer" || n.forRole === "admin" || n.forRole === "auditor"
  );
  if (notifications.length > 0) {
    await upsertRows("app_notifications", notifications.map(notificationToRow));
  }
}

async function syncAdminFull(payload: AppHydratePayload) {
  const tables: Array<{ table: string; rows: Record<string, unknown>[]; skipDelete?: boolean }> = [
    { table: "employees", rows: (payload.employees ?? []).map(employeeToRow) },
    { table: "brands", rows: (payload.brands ?? []).map(brandToRow) },
    { table: "external_companies", rows: (payload.companies ?? []).map(companyToRow) },
    { table: "advances", rows: (payload.advances ?? []).map(advanceToRow) },
    { table: "salary_extras", rows: (payload.salaryExtras ?? []).map(salaryExtraToRow) },
    { table: "sponsor_transactions", rows: (payload.sponsorTransactions ?? []).map(sponsorTxToRow) },
    { table: "internal_projects", rows: (payload.projects ?? []).map(projectToRow) },
    { table: "internal_project_payments", rows: (payload.projectPayments ?? []).map(projectPaymentToRow) },
    { table: "expense_entries", rows: (payload.expenses ?? []).map(expenseEntryToRow) },
    { table: "planned_items", rows: (payload.plannedItems ?? []).map(plannedToRow) },
    { table: "planned_item_payments", rows: (payload.plannedItemPayments ?? []).map(plannedPaymentToRow) },
    { table: "streamer_accounts", rows: (payload.streamerAccounts ?? []).map(streamerAccountToRow) },
    { table: "schedule_slots", rows: (payload.scheduleSlots ?? []).map(scheduleSlotToRow) },
    { table: "brand_links", rows: (payload.brandLinks ?? []).map(brandLinkToRow) },
    { table: "link_snapshots", rows: (payload.linkSnapshots ?? []).map(linkSnapshotToRow) },
    { table: "brand_viewership", rows: (payload.brandViewership ?? []).map(viewershipToRow) },
    { table: "brand_monthly_stats", rows: (payload.brandMonthlyStats ?? []).map(brandMonthlyStatsToRow) },
    // Kasa hesapları kasa_transactions FK referansı; önce hesaplar upsert edilmeli.
    // deleteNotIn yapmıyoruz: kullanıcı yanlışlıkla bağlı hareketleri olan
    // bir kasayı silerse FK RESTRICT hata fırlatır. Bunun yerine `archived`
    // bayrağıyla yönetiyoruz.
    { table: "kasas", rows: (payload.kasas ?? []).map(kasaAccountToRow), skipDelete: true },
    { table: "kasa_transactions", rows: (payload.kasaTransactions ?? []).map(kasaToRow) },
    { table: "content_expenses", rows: (payload.contentExpenses ?? []).map(contentExpenseToRow) },
    { table: "weekly_plans", rows: (payload.weeklyPlans ?? []).map(weeklyPlanToRow) },
    { table: "week_brand_reels", rows: (payload.weekBrandReels ?? []).map(weekBrandReelToRow) },
    { table: "app_notifications", rows: (payload.notifications ?? []).map(notificationToRow) },
  ];

  for (const { table, rows, skipDelete } of tables) {
    await upsertRows(table, rows);
    if (!skipDelete) {
      await deleteNotIn(table, rows.map((r) => String(r.id)));
    }
  }

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
  await upsertRows("content_expenses", expenses.map(contentExpenseToRow));
  await deleteNotIn("content_expenses", expenses.map((e) => e.id), {
    column: "employee_id",
    value: employeeId,
  });

  const plans = (payload.weeklyPlans ?? []).filter((p) => p.employeeId === employeeId);
  await upsertRows("weekly_plans", plans.map(weeklyPlanToRow));
  await deleteNotIn("weekly_plans", plans.map((p) => p.id), {
    column: "employee_id",
    value: employeeId,
  });

  const reels = (payload.weekBrandReels ?? []).filter((r) => r.employeeId === employeeId);
  await upsertRows("week_brand_reels", reels.map(weekBrandReelToRow));
  await deleteNotIn("week_brand_reels", reels.map((r) => r.id), {
    column: "employee_id",
    value: employeeId,
  });

  const accounts = (payload.streamerAccounts ?? []).filter((a) => a.employeeId === employeeId);
  await upsertRows("streamer_accounts", accounts.map(streamerAccountToRow));
  await deleteNotIn("streamer_accounts", accounts.map((a) => a.id), {
    column: "employee_id",
    value: employeeId,
  });

  const notifs = (payload.notifications ?? []).filter(
    (n) => n.forRole === "streamer"
  );
  await upsertRows("app_notifications", notifs.map(notificationToRow));

  const links = (payload.brandLinks ?? []).filter((l) => l.ownerId === employeeId);
  await upsertRows("brand_links", links.map(brandLinkToRow));
  await deleteNotIn("brand_links", links.map((l) => l.id), {
    column: "owner_id",
    value: employeeId,
  });

  const linkIds = links.map((l) => l.id);
  const snaps = (payload.linkSnapshots ?? []).filter((s) => linkIds.includes(s.linkId));
  await upsertRows("link_snapshots", snaps.map(linkSnapshotToRow));
  if (linkIds.length > 0) {
    const { data: existingSnaps, error: snapSelErr } = await getSupabaseAdmin()
      .from("link_snapshots")
      .select("id")
      .in("link_id", linkIds);
    if (snapSelErr) throw new Error(`link_snapshots select: ${snapSelErr.message}`);
    const keepIds = new Set(snaps.map((s) => s.id));
    const snapToDelete = (existingSnaps ?? [])
      .map((r) => String((r as { id: string }).id))
      .filter((id) => !keepIds.has(id));
    if (snapToDelete.length > 0) {
      const { error: snapDelErr } = await getSupabaseAdmin()
        .from("link_snapshots")
        .delete()
        .in("id", snapToDelete);
      if (snapDelErr) throw new Error(`link_snapshots delete: ${snapDelErr.message}`);
    }
  }

  const viewership = (payload.brandViewership ?? []).filter((v) => v.employeeId === employeeId);
  await upsertRows("brand_viewership", viewership.map(viewershipToRow));
  await deleteNotIn("brand_viewership", viewership.map((v) => v.id), {
    column: "employee_id",
    value: employeeId,
  });
}

export async function deleteAppUser(id: string) {
  const { error } = await getSupabaseAdmin().from("app_users").delete().eq("id", id);
  if (error) throw new Error(error.message);
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
