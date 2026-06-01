import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyPin } from "@/lib/password";
import { appUserExists, upsertAppUser } from "@/lib/db/upsert-app-user";
export { upsertAppUser, appUserExists };
import type { SessionPayload } from "@/lib/session";
import type {
  AppHydratePayload,
  Brand,
  BrandLink,
  BrandRegistrationRequest,
  StreamerRegistrationRequest,
  Organization,
  OrganizationMember,
  WeeklyPlan,
  AffiliatePartner,
  AffiliateDailyStat,
  AffiliatePayout,
  StreamerPoolProfile,
  BrandOffer,
  BrandOfferMessage,
  BrandDeal,
  BrandPost,
} from "@/store/store";
import { ensureExpenseSubmittedNotifications } from "@/lib/expense-notify";
import { dedupeSalaryExtrasByContentExpense } from "@/lib/salary-extra-dedupe";
import { syncContentExpensesAndSalaryExtras } from "@/lib/content-expense-sync";
import {
  filterBrandLinksWithValidBrands,
  loadValidBrandIds,
} from "@/lib/brand-links-sync";
import { filterWeeklyPlansForBrand } from "@/lib/weekly-plan-brand-match";
import { normalizeWeekAnchorIso, weekStartFromDateIso } from "@/lib/data";
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
  organizationFromRow, organizationMemberFromRow,
  brandRegistrationRequestFromRow, brandRegistrationRequestToRow,
  streamerRegistrationRequestFromRow, streamerRegistrationRequestToRow,
  affiliatePartnerFromRow, affiliatePartnerToRow,
  affiliateDailyStatFromRow, affiliateDailyStatToRow,
  affiliatePayoutFromRow, affiliatePayoutToRow,
  streamerPoolProfileFromRow, streamerPoolProfileToRow,
  brandOfferFromRow, brandOfferToRow,
  brandOfferMessageFromRow, brandOfferMessageToRow,
  brandDealFromRow, brandDealToRow,
  brandPostFromRow, brandPostToRow,
} from "@/lib/db/mappers";

type Rows = Record<string, unknown>[];

const SELECT_PAGE = 1000;

/** PostgREST varsayılan satır sınırını aşmamak için sayfalı okuma. */
async function selectAll<T>(table: string, map: (r: Record<string, unknown>) => T): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await getSupabaseAdmin()
      .from(table)
      .select("*")
      .range(from, from + SELECT_PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    const rows = data ?? [];
    out.push(...rows.map((r) => map(r as Record<string, unknown>)));
    if (rows.length < SELECT_PAGE) break;
    from += SELECT_PAGE;
  }
  return out;
}

/** İzlenme panosu — marka, link, snapshot, manuel rapor (yeniden yükleme için). */
export async function fetchViewershipBootstrap(
  session: SessionPayload
): Promise<
  Pick<AppHydratePayload, "brands" | "brandLinks" | "linkSnapshots" | "brandViewership">
> {
  const [brands, brandLinks, linkSnapshots, brandViewership] = await Promise.all([
    selectAll("brands", brandFromRow),
    selectAll("brand_links", brandLinkFromRow),
    selectAll("link_snapshots", linkSnapshotFromRow),
    selectAll("brand_viewership", viewershipFromRow),
  ]);
  const validBrandIds = await loadValidBrandIds(brands);
  const safeLinks = filterBrandLinksWithValidBrands(brandLinks, validBrandIds);

  if (session.role === "streamer" && session.employeeId) {
    const eid = session.employeeId;
    const myLinks = safeLinks.filter((l) => l.ownerId === eid);
    const myLinkIds = new Set(myLinks.map((l) => l.id));
    return {
      brands: brands.filter((b) => b.status === "active"),
      brandLinks: myLinks,
      linkSnapshots: linkSnapshots.filter((s) => myLinkIds.has(s.linkId)),
      brandViewership: brandViewership.filter((v) => v.employeeId === eid),
    };
  }

  if (session.role === "brand" && session.brandId) {
    const bid = session.brandId;
    const myLinks = safeLinks.filter((l) => l.brandId === bid);
    const myLinkIds = new Set(myLinks.map((l) => l.id));
    return {
      brands: brands.filter((b) => b.id === bid),
      brandLinks: myLinks,
      linkSnapshots: linkSnapshots.filter((s) => myLinkIds.has(s.linkId)),
      brandViewership: brandViewership.filter((v) => v.brandId === bid),
    };
  }

  return {
    brands,
    brandLinks: safeLinks,
    linkSnapshots,
    brandViewership,
  };
}

/** FK: yalnızca employees tablosunda olan id ile plan yaz. */
async function filterWeeklyPlanRows(plans: WeeklyPlan[]) {
  const { data, error } = await getSupabaseAdmin().from("employees").select("id");
  if (error) throw new Error(`employees: ${error.message}`);
  const valid = new Set((data ?? []).map((r) => String((r as { id: string }).id)));
  const byId = new Map<string, ReturnType<typeof weeklyPlanToRow>>();
  for (const p of plans) {
    if (!valid.has(p.employeeId)) continue;
    const date = p.date?.slice(0, 10) ?? "";
    const weekStart =
      weekStartFromDateIso(date) || normalizeWeekAnchorIso(p.weekStart);
    byId.set(p.id, weeklyPlanToRow({ ...p, date, weekStart }));
  }
  return [...byId.values()];
}

async function upsertRows(table: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  const { error } = await getSupabaseAdmin().from(table).upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`${table} upsert: ${error.message}`);
}

/** Boş URL/handle/owner ile mevcut link verisinin üzerine yazmayı engeller. */
export async function upsertBrandLinksMerged(
  links: BrandLink[],
  brandsFromPayload: Brand[] = []
) {
  if (links.length === 0) return;
  const validBrandIds = await loadValidBrandIds(brandsFromPayload);
  const safeLinks = filterBrandLinksWithValidBrands(links, validBrandIds);
  if (safeLinks.length === 0) return;

  const existing = await selectAll("brand_links", brandLinkFromRow);
  const byId = new Map(existing.map((l) => [l.id, l]));
  const merged = safeLinks.map((incoming) => {
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
/** Tüm organizasyonlar. */
export async function fetchOrganizations(): Promise<Organization[]> {
  return selectAll("organizations", organizationFromRow);
}

/** Tek organizasyon (id). */
export async function findOrganizationById(id: string): Promise<Organization | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("organizations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`organizations: ${error.message}`);
  return data ? organizationFromRow(data as Record<string, unknown>) : null;
}

/** Organizasyon kısmi güncelleme (snake_case alanlar). */
export async function updateOrganization(
  id: string,
  patch: Record<string, unknown>
): Promise<Organization> {
  const { data, error } = await getSupabaseAdmin()
    .from("organizations")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`organizations: ${error.message}`);
  if (!data) throw new Error("organizations: güncelleme sonuç dönmedi.");
  return organizationFromRow(data as Record<string, unknown>);
}

/** Üyelikler + erişilen marka id'leri (organization_member_brands join). */
export async function fetchOrganizationMembers(): Promise<OrganizationMember[]> {
  const [members, brandLinks] = await Promise.all([
    selectAll("organization_members", (r) => r as Record<string, unknown>),
    selectAll("organization_member_brands", (r) => r as Record<string, unknown>),
  ]);
  const byMember = new Map<string, string[]>();
  for (const mb of brandLinks) {
    const mid = String(mb.member_id);
    const arr = byMember.get(mid) ?? [];
    arr.push(String(mb.brand_id));
    byMember.set(mid, arr);
  }
  return members.map((r) =>
    organizationMemberFromRow(r, byMember.get(String(r.id)))
  );
}

/**
 * Bir kullanıcı için organizasyon bağlamını çözer: organizationId, orgRole ve
 * erişebildiği tüm brandIds. scope_all_brands ise org'un tüm markaları döner.
 */
async function resolveSessionOrgContext(userId: string): Promise<{
  organizationId?: string;
  orgRole?: string;
  brandIds?: string[];
}> {
  const admin = getSupabaseAdmin();
  const { data: memberRow } = await admin
    .from("organization_members")
    .select("*")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (!memberRow) return {};
  const m = memberRow as Record<string, unknown>;
  const orgId = String(m.organization_id);
  const orgRole = String(m.org_role);
  const scopeAll = Boolean(m.scope_all_brands);
  let brandIds: string[] = [];
  if (scopeAll) {
    const { data: brandRows } = await admin
      .from("brands")
      .select("id")
      .eq("organization_id", orgId);
    brandIds = (brandRows ?? []).map((b) => String((b as Record<string, unknown>).id));
  } else {
    const { data: mbRows } = await admin
      .from("organization_member_brands")
      .select("brand_id")
      .eq("member_id", String(m.id));
    brandIds = (mbRows ?? []).map((b) => String((b as Record<string, unknown>).brand_id));
  }
  return { organizationId: orgId, orgRole, brandIds };
}

export async function loginUser(username: string, pin: string): Promise<SessionPayload | null> {
  const un = username.toLowerCase().trim();
  const { data, error } = await getSupabaseAdmin()
    .from("app_users")
    .select("*")
    .eq("username", un)
    .eq("active", true)
    .maybeSingle();
  if (error) {
    throw new Error(`app_users: ${error.message}`);
  }
  if (!data) return null;
  const row = data as Record<string, unknown>;
  const ok = await verifyPin(pin, String(row.pin_hash));
  if (!ok) return null;
  const now = new Date().toISOString();
  await getSupabaseAdmin().from("app_users").update({ last_login_at: now }).eq("id", row.id);
  const org = await resolveSessionOrgContext(String(row.id)).catch(
    (): { organizationId?: string; orgRole?: string; brandIds?: string[] } => ({})
  );
  const brandId = row.brand_id
    ? String(row.brand_id)
    : org.brandIds && org.brandIds.length > 0
      ? org.brandIds[0]
      : undefined;
  return {
    userId: String(row.id),
    username: String(row.username),
    name: String(row.name),
    role: row.role as SessionPayload["role"],
    employeeId: row.employee_id ? String(row.employee_id) : undefined,
    brandId,
    avatar: String(row.avatar ?? ""),
    organizationId: org.organizationId,
    orgRole: org.orgRole,
    brandIds: org.brandIds && org.brandIds.length > 0 ? org.brandIds : brandId ? [brandId] : undefined,
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
    weekBrandReels, notifications, organizations, organizationMembers, affiliate, deals,
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
    // Organizasyon (Faz 0) — fail olursa bootstrap'i yıkmayalım.
    fetchOrganizations().catch((e) => {
      console.warn("[bootstrap] organizations fetch failed (returning empty)", e);
      return [] as Organization[];
    }),
    fetchOrganizationMembers().catch((e) => {
      console.warn("[bootstrap] organization_members fetch failed (returning empty)", e);
      return [] as OrganizationMember[];
    }),
    // Yeni tablolar (Faz C affiliate, Faz G/H deals) — schema cache veya RLS
    // bir nedenle fail edersek tüm bootstrap'i yıkmayalım; eski veriler
    // (kasa, link, snapshot, vs.) korunsun. Boş diziye düşüp UI banner gösterir.
    fetchAffiliateBootstrap(session).catch((e) => {
      console.warn("[bootstrap] affiliate fetch failed (returning empty)", e);
      return {
        affiliatePartners: [],
        affiliateDailyStats: [],
        affiliatePayouts: [],
      };
    }),
    fetchDealsBootstrap(session).catch((e) => {
      console.warn("[bootstrap] deals/pool fetch failed (returning empty)", e);
      return {
        streamerPoolProfiles: [],
        brandOffers: [],
        brandOfferMessages: [],
        brandDeals: [],
        brandPosts: [],
      };
    }),
  ]);

  const payload: AppHydratePayload & { users?: AppUser[] } = {
    organizations,
    organizationMembers,
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
    affiliatePartners: affiliate.affiliatePartners,
    affiliateDailyStats: affiliate.affiliateDailyStats,
    affiliatePayouts: affiliate.affiliatePayouts,
    streamerPoolProfiles: deals.streamerPoolProfiles,
    brandOffers: deals.brandOffers,
    brandOfferMessages: deals.brandOfferMessages,
    brandDeals: deals.brandDeals,
    brandPosts: deals.brandPosts,
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
      affiliatePartners: affiliate.affiliatePartners,
      affiliateDailyStats: affiliate.affiliateDailyStats,
      affiliatePayouts: affiliate.affiliatePayouts,
      streamerPoolProfiles: deals.streamerPoolProfiles,
      brandOffers: deals.brandOffers,
      brandOfferMessages: deals.brandOfferMessages,
      brandDeals: deals.brandDeals,
      brandPosts: deals.brandPosts,
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

  if (session.role === "brand" && (session.brandId || (session.brandIds && session.brandIds.length > 0))) {
    const bidList = session.brandIds && session.brandIds.length > 0
      ? session.brandIds
      : session.brandId
        ? [session.brandId]
        : [];
    const bidSet = new Set(bidList);
    const inScope = (id: string | undefined | null) => !!id && bidSet.has(id);
    // Markaya ait planlı kalemler ve onların taksitleri
    const myPlannedItems = plannedItems.filter((p) => inScope(p.brandId));
    const myPlannedItemIds = new Set(myPlannedItems.map((p) => p.id));
    const myPlannedItemPayments = plannedItemPayments.filter((pp) =>
      myPlannedItemIds.has(pp.plannedItemId)
    );
    // Marka takviminde / izlenmelerinde yayıncı adı görmek için aktif yayıncı/moderatörler
    const visibleEmployees = employees.filter(
      (e) => e.kind === "streamer" || e.kind === "moderator"
    );
    const scopedBrandRows = brands.filter((b) => bidSet.has(b.id));
    const myWeeklyPlans = scopedBrandRows.flatMap((brandRow) =>
      filterWeeklyPlansForBrand(weeklyPlans, brandRow)
    );
    const myOrgId = session.organizationId;
    return {
      organizations: myOrgId ? organizations.filter((o) => o.id === myOrgId) : organizations,
      organizationMembers: myOrgId
        ? organizationMembers.filter((m) => m.organizationId === myOrgId)
        : organizationMembers,
      employees: visibleEmployees,
      advances: [],
      salaryExtras: [],
      paymentStatuses: [],
      companies: [],
      sponsorTransactions: [],
      projects: [],
      projectPayments: [],
      expenses: expenses.filter((e) => inScope(e.brandId)),
      plannedItems: myPlannedItems,
      plannedItemPayments: myPlannedItemPayments,
      streamerAccounts: streamerAccounts.filter((a) =>
        visibleEmployees.some((e) => e.id === a.employeeId)
      ),
      scheduleSlots,
      brands: scopedBrandRows,
      brandLinks: brandLinks.filter((l) => inScope(l.brandId)),
      linkSnapshots: linkSnapshots.filter((s) =>
        brandLinks.some((l) => l.id === s.linkId && inScope(l.brandId))
      ),
      brandViewership: brandViewership.filter((v) => inScope(v.brandId)),
      brandMonthlyStats: brandMonthlyStats.filter((s) => inScope(s.brandId)),
      affiliatePartners: affiliate.affiliatePartners,
      affiliateDailyStats: affiliate.affiliateDailyStats,
      affiliatePayouts: affiliate.affiliatePayouts,
      streamerPoolProfiles: deals.streamerPoolProfiles,
      brandOffers: deals.brandOffers,
      brandOfferMessages: deals.brandOfferMessages,
      brandDeals: deals.brandDeals,
      brandPosts: deals.brandPosts,
      kasas: [],
      kasaTransactions: [],
      contentExpenses: contentExpenses.filter((c) => inScope(c.brandId)),
      weeklyPlans: myWeeklyPlans,
      weekBrandReels: weekBrandReels.filter((r) => inScope(r.brandId)),
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

  const weeklyPlanRows = await filterWeeklyPlanRows(payload.weeklyPlans ?? []);

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
    // brand_links / link_snapshots / brand_viewership: toplu sync YOK — yalnızca row-persist,
    // refresh-runner ve /api/bootstrap/viewership (boş istemci state DB'yi ezmesin).
    // link_snapshots / brand_viewership: yalnızca row-persist, refresh-runner ve admin API.
    // Toplu sync ile yazılmaz — boş/eksik istemci state veri kaybı riski.
    // Kasa hesapları kasa_transactions FK referansı; önce hesaplar upsert edilmeli.
    // deleteNotIn yapmıyoruz: kullanıcı yanlışlıkla bağlı hareketleri olan
    // bir kasayı silerse FK RESTRICT hata fırlatır. Bunun yerine `archived`
    // bayrağıyla yönetiyoruz.
    { table: "kasas", rows: (payload.kasas ?? []).map(kasaAccountToRow), skipDelete: true },
    // Kasa hareketleri tek tek API ile de yazılır; toplu silme yapılmaz (veri kaybı önlenir).
    { table: "kasa_transactions", rows: (payload.kasaTransactions ?? []).map(kasaToRow), skipDelete: true },
    { table: "weekly_plans", rows: weeklyPlanRows, skipDelete: true },
    { table: "week_brand_reels", rows: (payload.weekBrandReels ?? []).map(weekBrandReelToRow), skipDelete: true },
    { table: "app_notifications", rows: (payload.notifications ?? []).map(notificationToRow) },
  ];

  for (const { table, rows, skipDelete } of tables) {
    await upsertRows(table, rows);
    if (!skipDelete && rows.length > 0) {
      await deleteNotIn(table, rows.map((r) => String(r.id)));
    }
  }

  await syncContentExpensesAndSalaryExtras(
    payloadDeduped.contentExpenses ?? [],
    payloadDeduped.salaryExtras ?? []
  );

  const validBrandIds = await loadValidBrandIds(payload.brands ?? []);
  const brandStats = (payload.brandMonthlyStats ?? []).filter((s) =>
    validBrandIds.has(s.brandId)
  );
  if (brandStats.length > 0) {
    await upsertRows("brand_monthly_stats", brandStats.map(brandMonthlyStatsToRow));
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
  const planRows = await filterWeeklyPlanRows(plans);
  if (planRows.length > 0) {
    await upsertRows("weekly_plans", planRows);
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

  // brand_links / snapshots / viewership: yalnızca row-persist ve admin refresh API.
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

/**
 * Marka kayıt başvuruları (Faz A).
 * `status` verilirse yalnızca o statüdeki kayıtlar döner; aksi halde hepsi
 * en yeni en üstte.
 */
export async function fetchBrandRegistrationRequests(
  status?: BrandRegistrationRequest["status"]
): Promise<BrandRegistrationRequest[]> {
  let q = getSupabaseAdmin()
    .from("brand_registration_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw new Error(`brand_registration_requests: ${error.message}`);
  return (data ?? []).map((r) =>
    brandRegistrationRequestFromRow(r as Record<string, unknown>)
  );
}

export async function findBrandRegistrationRequestById(
  id: string
): Promise<BrandRegistrationRequest | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_registration_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`brand_registration_requests: ${error.message}`);
  return data
    ? brandRegistrationRequestFromRow(data as Record<string, unknown>)
    : null;
}

/**
 * Aynı email + brand_name + gün kombinasyonu için son 24 saatte mevcut bir
 * `pending` başvuru varsa onu döndürür (duplicate kontrolü için).
 */
export async function findRecentPendingRegistration(
  contactEmail: string,
  brandName: string
): Promise<BrandRegistrationRequest | null> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from("brand_registration_requests")
    .select("*")
    .eq("contact_email", contactEmail.toLowerCase().trim())
    .eq("brand_name", brandName.trim())
    .eq("status", "pending")
    .gte("created_at", oneDayAgo)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(`brand_registration_requests: ${error.message}`);
  const rows = data ?? [];
  return rows.length > 0
    ? brandRegistrationRequestFromRow(rows[0] as Record<string, unknown>)
    : null;
}

export async function createBrandRegistrationRequest(
  r: BrandRegistrationRequest
): Promise<BrandRegistrationRequest> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_registration_requests")
    .insert(brandRegistrationRequestToRow(r))
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`brand_registration_requests: ${error.message}`);
  if (!data) throw new Error("brand_registration_requests: insert sonuç dönmedi.");
  return brandRegistrationRequestFromRow(data as Record<string, unknown>);
}

export async function updateBrandRegistrationRequest(
  id: string,
  patch: Partial<{
    status: BrandRegistrationRequest["status"];
    rejectionReason: string | null;
    reviewedBy: string | null;
    reviewedAt: string | null;
    createdBrandId: string | null;
    createdUserId: string | null;
    // Onay öncesi düzenlenebilir başvuru alanları
    brandName: string;
    shortName: string | null;
    category: string;
    website: string | null;
    contactName: string;
    contactEmail: string;
    contactPhone: string | null;
    telegram: string | null;
    monthlyVolume: string | null;
    preferredUsername: string | null;
    notes: string;
  }>
): Promise<BrandRegistrationRequest> {
  const row: Record<string, unknown> = {};
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.rejectionReason !== undefined) row.rejection_reason = patch.rejectionReason;
  if (patch.reviewedBy !== undefined) row.reviewed_by = patch.reviewedBy;
  if (patch.reviewedAt !== undefined) row.reviewed_at = patch.reviewedAt;
  if (patch.createdBrandId !== undefined) row.created_brand_id = patch.createdBrandId;
  if (patch.createdUserId !== undefined) row.created_user_id = patch.createdUserId;
  if (patch.brandName !== undefined) row.brand_name = patch.brandName;
  if (patch.shortName !== undefined) row.short_name = patch.shortName;
  if (patch.category !== undefined) row.category = patch.category;
  if (patch.website !== undefined) row.website = patch.website;
  if (patch.contactName !== undefined) row.contact_name = patch.contactName;
  if (patch.contactEmail !== undefined) row.contact_email = patch.contactEmail.toLowerCase().trim();
  if (patch.contactPhone !== undefined) row.contact_phone = patch.contactPhone;
  if (patch.telegram !== undefined) row.telegram = patch.telegram;
  if (patch.monthlyVolume !== undefined) row.monthly_volume = patch.monthlyVolume;
  if (patch.preferredUsername !== undefined) row.preferred_username = patch.preferredUsername;
  if (patch.notes !== undefined) row.notes = patch.notes;
  row.updated_at = new Date().toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from("brand_registration_requests")
    .update(row)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`brand_registration_requests: ${error.message}`);
  if (!data) throw new Error("brand_registration_requests: güncellenmek istenen kayıt bulunamadı.");
  return brandRegistrationRequestFromRow(data as Record<string, unknown>);
}

// ─────────────────────────────────────────────────────────────────────────────
// Yayıncı kayıt başvuruları (Faz 2)
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchStreamerRegistrationRequests(
  status?: StreamerRegistrationRequest["status"]
): Promise<StreamerRegistrationRequest[]> {
  let q = getSupabaseAdmin()
    .from("streamer_registration_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw new Error(`streamer_registration_requests: ${error.message}`);
  return (data ?? []).map((r) =>
    streamerRegistrationRequestFromRow(r as Record<string, unknown>)
  );
}

export async function findStreamerRegistrationRequestById(
  id: string
): Promise<StreamerRegistrationRequest | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("streamer_registration_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`streamer_registration_requests: ${error.message}`);
  return data
    ? streamerRegistrationRequestFromRow(data as Record<string, unknown>)
    : null;
}

export async function findRecentPendingStreamerRegistration(
  contactEmail: string,
  displayName: string
): Promise<StreamerRegistrationRequest | null> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from("streamer_registration_requests")
    .select("*")
    .eq("contact_email", contactEmail.toLowerCase().trim())
    .eq("display_name", displayName.trim())
    .eq("status", "pending")
    .gte("created_at", oneDayAgo)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(`streamer_registration_requests: ${error.message}`);
  const row = (data ?? [])[0];
  return row ? streamerRegistrationRequestFromRow(row as Record<string, unknown>) : null;
}

export async function createStreamerRegistrationRequest(
  r: StreamerRegistrationRequest
): Promise<StreamerRegistrationRequest> {
  const { data, error } = await getSupabaseAdmin()
    .from("streamer_registration_requests")
    .insert(streamerRegistrationRequestToRow(r))
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`streamer_registration_requests: ${error.message}`);
  if (!data) throw new Error("streamer_registration_requests: insert sonuç dönmedi.");
  return streamerRegistrationRequestFromRow(data as Record<string, unknown>);
}

export async function updateStreamerRegistrationRequest(
  id: string,
  patch: Partial<{
    status: StreamerRegistrationRequest["status"];
    rejectionReason: string | null;
    reviewedBy: string | null;
    reviewedAt: string | null;
    createdEmployeeId: string | null;
    createdUserId: string | null;
    // Onay öncesi düzenlenebilir başvuru alanları
    displayName: string;
    realName: string | null;
    contactEmail: string;
    contactPhone: string | null;
    telegram: string | null;
    platforms: string;
    categories: string;
    audienceSize: string | null;
    preferredUsername: string | null;
    notes: string;
  }>
): Promise<StreamerRegistrationRequest> {
  const row: Record<string, unknown> = {};
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.rejectionReason !== undefined) row.rejection_reason = patch.rejectionReason;
  if (patch.reviewedBy !== undefined) row.reviewed_by = patch.reviewedBy;
  if (patch.reviewedAt !== undefined) row.reviewed_at = patch.reviewedAt;
  if (patch.createdEmployeeId !== undefined) row.created_employee_id = patch.createdEmployeeId;
  if (patch.createdUserId !== undefined) row.created_user_id = patch.createdUserId;
  if (patch.displayName !== undefined) row.display_name = patch.displayName;
  if (patch.realName !== undefined) row.real_name = patch.realName;
  if (patch.contactEmail !== undefined) row.contact_email = patch.contactEmail.toLowerCase().trim();
  if (patch.contactPhone !== undefined) row.contact_phone = patch.contactPhone;
  if (patch.telegram !== undefined) row.telegram = patch.telegram;
  if (patch.platforms !== undefined) row.platforms = patch.platforms;
  if (patch.categories !== undefined) row.categories = patch.categories;
  if (patch.audienceSize !== undefined) row.audience_size = patch.audienceSize;
  if (patch.preferredUsername !== undefined) row.preferred_username = patch.preferredUsername;
  if (patch.notes !== undefined) row.notes = patch.notes;
  row.updated_at = new Date().toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from("streamer_registration_requests")
    .update(row)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`streamer_registration_requests: ${error.message}`);
  if (!data) throw new Error("streamer_registration_requests: güncellenmek istenen kayıt bulunamadı.");
  return streamerRegistrationRequestFromRow(data as Record<string, unknown>);
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

// ─────────────────────────────────────────────────────────────────────────────
// Affiliate Tracking (Faz C)
// ─────────────────────────────────────────────────────────────────────────────

/** Tüm partner'ları döner; `brandId` verilirse o markaya filtreler. */
export async function fetchAffiliatePartners(
  brandId?: string
): Promise<AffiliatePartner[]> {
  let q = getSupabaseAdmin()
    .from("affiliate_partners")
    .select("*")
    .order("created_at", { ascending: false });
  if (brandId) q = q.eq("brand_id", brandId);
  const { data, error } = await q;
  if (error) throw new Error(`affiliate_partners: ${error.message}`);
  return (data ?? []).map((r) => affiliatePartnerFromRow(r as Record<string, unknown>));
}

export async function findAffiliatePartnerById(
  id: string
): Promise<AffiliatePartner | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("affiliate_partners")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`affiliate_partners: ${error.message}`);
  return data ? affiliatePartnerFromRow(data as Record<string, unknown>) : null;
}

export async function findAffiliatePartnersByExternalRefs(
  brandId: string,
  externalRefs: string[]
): Promise<AffiliatePartner[]> {
  const refs = externalRefs.map((r) => r.trim()).filter(Boolean);
  if (refs.length === 0) return [];
  const { data, error } = await getSupabaseAdmin()
    .from("affiliate_partners")
    .select("*")
    .eq("brand_id", brandId)
    .in("external_ref", refs);
  if (error) throw new Error(`affiliate_partners: ${error.message}`);
  return (data ?? []).map((r) => affiliatePartnerFromRow(r as Record<string, unknown>));
}

export async function upsertAffiliatePartner(
  partner: AffiliatePartner
): Promise<AffiliatePartner> {
  const { data, error } = await getSupabaseAdmin()
    .from("affiliate_partners")
    .upsert(affiliatePartnerToRow(partner), { onConflict: "id" })
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`affiliate_partners: ${error.message}`);
  if (!data) throw new Error("affiliate_partners: upsert sonuç dönmedi.");
  return affiliatePartnerFromRow(data as Record<string, unknown>);
}

export async function deleteAffiliatePartner(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("affiliate_partners")
    .delete()
    .eq("id", id);
  if (error) throw new Error(`affiliate_partners: ${error.message}`);
}

export interface AffiliateStatsFilter {
  brandId?: string;
  partnerId?: string;
  /** YYYY-MM-DD (inclusive). */
  from?: string;
  /** YYYY-MM-DD (inclusive). */
  to?: string;
  /** Default 5000 — bir batch için yeterli (90 gün × ~50 partner). */
  limit?: number;
}

/** Günlük istatistik satırları. Filtre yoksa default son 5000 satırı döner. */
export async function fetchAffiliateDailyStats(
  filter: AffiliateStatsFilter = {}
): Promise<AffiliateDailyStat[]> {
  const limit = Math.max(1, Math.min(20000, filter.limit ?? 5000));
  let q = getSupabaseAdmin()
    .from("affiliate_daily_stats")
    .select("*")
    .order("stat_date", { ascending: false })
    .limit(limit);
  if (filter.brandId) q = q.eq("brand_id", filter.brandId);
  if (filter.partnerId) q = q.eq("partner_id", filter.partnerId);
  if (filter.from) q = q.gte("stat_date", filter.from);
  if (filter.to) q = q.lte("stat_date", filter.to);
  const { data, error } = await q;
  if (error) throw new Error(`affiliate_daily_stats: ${error.message}`);
  return (data ?? []).map((r) => affiliateDailyStatFromRow(r as Record<string, unknown>));
}

/**
 * Bulk upsert — UNIQUE (partner_id, stat_date) çakışmasında günceller.
 * Tek transaction içinde tüm satırlar gönderilir.
 */
export async function bulkUpsertAffiliateDailyStats(
  rows: AffiliateDailyStat[]
): Promise<{ count: number }> {
  if (rows.length === 0) return { count: 0 };
  const payload = rows.map(affiliateDailyStatToRow);
  const { error } = await getSupabaseAdmin()
    .from("affiliate_daily_stats")
    .upsert(payload, { onConflict: "partner_id,stat_date" });
  if (error) throw new Error(`affiliate_daily_stats: ${error.message}`);
  return { count: payload.length };
}

export async function fetchAffiliatePayouts(
  brandId?: string
): Promise<AffiliatePayout[]> {
  let q = getSupabaseAdmin()
    .from("affiliate_payouts")
    .select("*")
    .order("period_end", { ascending: false });
  if (brandId) q = q.eq("brand_id", brandId);
  const { data, error } = await q;
  if (error) throw new Error(`affiliate_payouts: ${error.message}`);
  return (data ?? []).map((r) => affiliatePayoutFromRow(r as Record<string, unknown>));
}

/** Açık ödemeler (pending + approved) — bootstrap için. */
export async function fetchOpenAffiliatePayouts(
  brandId?: string
): Promise<AffiliatePayout[]> {
  let q = getSupabaseAdmin()
    .from("affiliate_payouts")
    .select("*")
    .in("status", ["pending", "approved"])
    .order("period_end", { ascending: false });
  if (brandId) q = q.eq("brand_id", brandId);
  const { data, error } = await q;
  if (error) throw new Error(`affiliate_payouts: ${error.message}`);
  return (data ?? []).map((r) => affiliatePayoutFromRow(r as Record<string, unknown>));
}

export async function findAffiliatePayoutById(
  id: string
): Promise<AffiliatePayout | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("affiliate_payouts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`affiliate_payouts: ${error.message}`);
  return data ? affiliatePayoutFromRow(data as Record<string, unknown>) : null;
}

export async function upsertAffiliatePayout(
  payout: AffiliatePayout
): Promise<AffiliatePayout> {
  const { data, error } = await getSupabaseAdmin()
    .from("affiliate_payouts")
    .upsert(affiliatePayoutToRow(payout), { onConflict: "id" })
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`affiliate_payouts: ${error.message}`);
  if (!data) throw new Error("affiliate_payouts: upsert sonuç dönmedi.");
  return affiliatePayoutFromRow(data as Record<string, unknown>);
}

export async function deleteAffiliatePayout(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("affiliate_payouts")
    .delete()
    .eq("id", id);
  if (error) throw new Error(`affiliate_payouts: ${error.message}`);
}

/**
 * Bootstrap için affiliate alt-payload'u. Brand kullanıcıda dailyStats son 90
 * günle sınırlı; admin'de tümü (CSV import / global view için).
 */
export async function fetchAffiliateBootstrap(session: SessionPayload): Promise<{
  affiliatePartners: AffiliatePartner[];
  affiliateDailyStats: AffiliateDailyStat[];
  affiliatePayouts: AffiliatePayout[];
}> {
  if (session.role === "brand" && session.brandId) {
    const bid = session.brandId;
    const ninetyDaysAgoIso = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const [partners, stats, payouts] = await Promise.all([
      fetchAffiliatePartners(bid),
      fetchAffiliateDailyStats({ brandId: bid, from: ninetyDaysAgoIso, limit: 20000 }),
      fetchOpenAffiliatePayouts(bid),
    ]);
    return {
      affiliatePartners: partners,
      affiliateDailyStats: stats,
      affiliatePayouts: payouts,
    };
  }

  if (session.role === "admin" || session.role === "auditor") {
    const [partners, stats, payouts] = await Promise.all([
      fetchAffiliatePartners(),
      fetchAffiliateDailyStats({ limit: 20000 }),
      fetchAffiliatePayouts(),
    ]);
    return {
      affiliatePartners: partners,
      affiliateDailyStats: stats,
      affiliatePayouts: payouts,
    };
  }

  // Yayıncı (streamer) — kendi employeeId'sine bağlı partner'ları görsün.
  if (session.role === "streamer" && session.employeeId) {
    const eid = session.employeeId;
    const { data, error } = await getSupabaseAdmin()
      .from("affiliate_partners")
      .select("*")
      .eq("employee_id", eid);
    if (error) throw new Error(`affiliate_partners: ${error.message}`);
    const partners = (data ?? []).map((r) =>
      affiliatePartnerFromRow(r as Record<string, unknown>)
    );
    const partnerIds = partners.map((p) => p.id);
    if (partnerIds.length === 0) {
      return { affiliatePartners: [], affiliateDailyStats: [], affiliatePayouts: [] };
    }
    const { data: statRows, error: statErr } = await getSupabaseAdmin()
      .from("affiliate_daily_stats")
      .select("*")
      .in("partner_id", partnerIds)
      .order("stat_date", { ascending: false })
      .limit(20000);
    if (statErr) throw new Error(`affiliate_daily_stats: ${statErr.message}`);
    return {
      affiliatePartners: partners,
      affiliateDailyStats: (statRows ?? []).map((r) =>
        affiliateDailyStatFromRow(r as Record<string, unknown>)
      ),
      affiliatePayouts: [],
    };
  }

  return { affiliatePartners: [], affiliateDailyStats: [], affiliatePayouts: [] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Yayıncı Havuzu + Teklif (Faz G)
// ─────────────────────────────────────────────────────────────────────────────

export interface StreamerPoolFilter {
  status?: StreamerPoolProfile["status"];
  /**
   * `brandView=true` → marka kullanıcısının görebileceği profiller (status=published
   * + visibility in ('public','brand_only')). Admin/streamer için kapalı.
   */
  brandView?: boolean;
  employeeIds?: string[];
}

export async function fetchStreamerPoolProfiles(
  filter: StreamerPoolFilter = {}
): Promise<StreamerPoolProfile[]> {
  let q = getSupabaseAdmin()
    .from("streamer_pool_profiles")
    .select("*")
    .order("updated_at", { ascending: false });
  if (filter.status) q = q.eq("status", filter.status);
  if (filter.brandView) {
    q = q.eq("status", "published").in("visibility", ["public", "brand_only"]);
  }
  if (filter.employeeIds && filter.employeeIds.length > 0) {
    q = q.in("employee_id", filter.employeeIds);
  }
  const { data, error } = await q;
  if (error) throw new Error(`streamer_pool_profiles: ${error.message}`);
  return (data ?? []).map((r) =>
    streamerPoolProfileFromRow(r as Record<string, unknown>)
  );
}

export async function findStreamerPoolProfileByEmployee(
  employeeId: string
): Promise<StreamerPoolProfile | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("streamer_pool_profiles")
    .select("*")
    .eq("employee_id", employeeId)
    .maybeSingle();
  if (error) throw new Error(`streamer_pool_profiles: ${error.message}`);
  return data ? streamerPoolProfileFromRow(data as Record<string, unknown>) : null;
}

export async function upsertStreamerPoolProfile(
  profile: StreamerPoolProfile
): Promise<StreamerPoolProfile> {
  const { data, error } = await getSupabaseAdmin()
    .from("streamer_pool_profiles")
    .upsert(streamerPoolProfileToRow(profile), { onConflict: "id" })
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`streamer_pool_profiles: ${error.message}`);
  if (!data) throw new Error("streamer_pool_profiles: upsert sonuç dönmedi.");
  return streamerPoolProfileFromRow(data as Record<string, unknown>);
}

export interface BrandOfferFilter {
  brandId?: string;
  employeeId?: string;
  status?: BrandOffer["status"];
}

export async function fetchBrandOffers(
  filter: BrandOfferFilter = {}
): Promise<BrandOffer[]> {
  let q = getSupabaseAdmin()
    .from("brand_offers")
    .select("*")
    .order("created_at", { ascending: false });
  if (filter.brandId) q = q.eq("brand_id", filter.brandId);
  if (filter.employeeId) q = q.eq("employee_id", filter.employeeId);
  if (filter.status) q = q.eq("status", filter.status);
  const { data, error } = await q;
  if (error) throw new Error(`brand_offers: ${error.message}`);
  return (data ?? []).map((r) => brandOfferFromRow(r as Record<string, unknown>));
}

export async function findBrandOfferById(id: string): Promise<BrandOffer | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_offers")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`brand_offers: ${error.message}`);
  return data ? brandOfferFromRow(data as Record<string, unknown>) : null;
}

export async function upsertBrandOffer(offer: BrandOffer): Promise<BrandOffer> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_offers")
    .upsert(brandOfferToRow(offer), { onConflict: "id" })
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`brand_offers: ${error.message}`);
  if (!data) throw new Error("brand_offers: upsert sonuç dönmedi.");
  return brandOfferFromRow(data as Record<string, unknown>);
}

export async function appendBrandOfferMessage(
  message: BrandOfferMessage
): Promise<BrandOfferMessage> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_offer_messages")
    .insert(brandOfferMessageToRow(message))
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`brand_offer_messages: ${error.message}`);
  if (!data) throw new Error("brand_offer_messages: insert sonuç dönmedi.");
  return brandOfferMessageFromRow(data as Record<string, unknown>);
}

export async function fetchBrandOfferMessages(
  offerId: string
): Promise<BrandOfferMessage[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_offer_messages")
    .select("*")
    .eq("offer_id", offerId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`brand_offer_messages: ${error.message}`);
  return (data ?? []).map((r) =>
    brandOfferMessageFromRow(r as Record<string, unknown>)
  );
}

export async function fetchBrandOfferMessagesByOfferIds(
  offerIds: string[]
): Promise<BrandOfferMessage[]> {
  if (offerIds.length === 0) return [];
  const { data, error } = await getSupabaseAdmin()
    .from("brand_offer_messages")
    .select("*")
    .in("offer_id", offerIds)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`brand_offer_messages: ${error.message}`);
  return (data ?? []).map((r) =>
    brandOfferMessageFromRow(r as Record<string, unknown>)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Anlaşma + Post Takibi (Faz H)
// ─────────────────────────────────────────────────────────────────────────────

export interface BrandDealFilter {
  brandId?: string;
  employeeId?: string;
  status?: BrandDeal["status"];
}

export async function fetchBrandDeals(filter: BrandDealFilter = {}): Promise<BrandDeal[]> {
  let q = getSupabaseAdmin()
    .from("brand_deals")
    .select("*")
    .order("created_at", { ascending: false });
  if (filter.brandId) q = q.eq("brand_id", filter.brandId);
  if (filter.employeeId) q = q.eq("employee_id", filter.employeeId);
  if (filter.status) q = q.eq("status", filter.status);
  const { data, error } = await q;
  if (error) throw new Error(`brand_deals: ${error.message}`);
  return (data ?? []).map((r) => brandDealFromRow(r as Record<string, unknown>));
}

export async function findBrandDealById(id: string): Promise<BrandDeal | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_deals")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`brand_deals: ${error.message}`);
  return data ? brandDealFromRow(data as Record<string, unknown>) : null;
}

export async function upsertBrandDeal(deal: BrandDeal): Promise<BrandDeal> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_deals")
    .upsert(brandDealToRow(deal), { onConflict: "id" })
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`brand_deals: ${error.message}`);
  if (!data) throw new Error("brand_deals: upsert sonuç dönmedi.");
  return brandDealFromRow(data as Record<string, unknown>);
}

/**
 * Faz G accept akışı: bir offer + opsiyonel ek alanlardan yeni bir deal satırı
 * üretir. `posts_count` / `total_views` denormalize alanlarına dokunmaz (trigger
 * yönetir).
 */
export async function createBrandDealFromOffer(
  offer: BrandOffer,
  additional: Partial<
    Pick<BrandDeal, "id" | "title" | "budgetUsd" | "startDate" | "endDate" | "notes" | "contractUrl">
  > = {}
): Promise<BrandDeal> {
  const id =
    additional.id ?? `bd-${crypto.randomUUID().slice(0, 10)}`;
  const deal: BrandDeal = {
    id,
    brandId: offer.brandId,
    employeeId: offer.employeeId,
    originOfferId: offer.id,
    title: additional.title ?? offer.title,
    dealType: offer.offerType,
    status: "active",
    budgetUsd: additional.budgetUsd ?? offer.budgetUsd ?? 0,
    paidUsd: 0,
    startDate: additional.startDate ?? offer.startDate,
    endDate: additional.endDate ?? offer.endDate,
    deliverables: (offer.deliverables ?? []).map((d) => ({
      type: d.type,
      count: d.count,
      platform: d.platform,
    })),
    postsCount: 0,
    totalViews: 0,
    notes: additional.notes ?? offer.notes ?? "",
    contractUrl: additional.contractUrl,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return upsertBrandDeal(deal);
}

export interface BrandPostFilter {
  brandId?: string;
  dealId?: string;
  employeeId?: string;
  platform?: BrandPost["platform"];
  status?: BrandPost["status"];
  limit?: number;
}

export async function fetchBrandPosts(filter: BrandPostFilter = {}): Promise<BrandPost[]> {
  const limit = Math.max(1, Math.min(5000, filter.limit ?? 1000));
  let q = getSupabaseAdmin()
    .from("brand_posts")
    .select("*")
    .order("posted_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (filter.brandId) q = q.eq("brand_id", filter.brandId);
  if (filter.dealId) q = q.eq("deal_id", filter.dealId);
  if (filter.employeeId) q = q.eq("employee_id", filter.employeeId);
  if (filter.platform) q = q.eq("platform", filter.platform);
  if (filter.status) q = q.eq("status", filter.status);
  const { data, error } = await q;
  if (error) throw new Error(`brand_posts: ${error.message}`);
  return (data ?? []).map((r) => brandPostFromRow(r as Record<string, unknown>));
}

export async function findBrandPostById(id: string): Promise<BrandPost | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_posts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`brand_posts: ${error.message}`);
  return data ? brandPostFromRow(data as Record<string, unknown>) : null;
}

export async function findBrandPostByUrl(
  brandId: string,
  url: string
): Promise<BrandPost | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_posts")
    .select("*")
    .eq("brand_id", brandId)
    .eq("url", url)
    .maybeSingle();
  if (error) throw new Error(`brand_posts: ${error.message}`);
  return data ? brandPostFromRow(data as Record<string, unknown>) : null;
}

export async function upsertBrandPost(post: BrandPost): Promise<BrandPost> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_posts")
    .upsert(brandPostToRow(post), { onConflict: "id" })
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`brand_posts: ${error.message}`);
  if (!data) throw new Error("brand_posts: upsert sonuç dönmedi.");
  return brandPostFromRow(data as Record<string, unknown>);
}

export async function deleteBrandPost(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from("brand_posts").delete().eq("id", id);
  if (error) throw new Error(`brand_posts: ${error.message}`);
}

/**
 * Bootstrap için Faz G + H alt-payload'u. Scope rolüne göre filtrelenir.
 *
 * - admin / auditor: tümü
 * - brand: kendi brand_id'sine bağlı offer / deal / post + published+visible pool
 * - streamer: kendi employee_id'sine bağlı offer / deal / post + kendi pool profili
 */
export async function fetchDealsBootstrap(session: SessionPayload): Promise<{
  streamerPoolProfiles: StreamerPoolProfile[];
  brandOffers: BrandOffer[];
  brandOfferMessages: BrandOfferMessage[];
  brandDeals: BrandDeal[];
  brandPosts: BrandPost[];
}> {
  if (session.role === "admin" || session.role === "auditor") {
    const [profiles, offers, deals, posts] = await Promise.all([
      fetchStreamerPoolProfiles(),
      fetchBrandOffers(),
      fetchBrandDeals(),
      fetchBrandPosts({ limit: 5000 }),
    ]);
    const messages = await fetchBrandOfferMessagesByOfferIds(offers.map((o) => o.id));
    return {
      streamerPoolProfiles: profiles,
      brandOffers: offers,
      brandOfferMessages: messages,
      brandDeals: deals,
      brandPosts: posts,
    };
  }

  if (session.role === "brand" && session.brandId) {
    const bid = session.brandId;
    const [profiles, offers, deals, posts] = await Promise.all([
      fetchStreamerPoolProfiles({ brandView: true }),
      fetchBrandOffers({ brandId: bid }),
      fetchBrandDeals({ brandId: bid }),
      fetchBrandPosts({ brandId: bid, limit: 2000 }),
    ]);
    const messages = await fetchBrandOfferMessagesByOfferIds(offers.map((o) => o.id));
    return {
      streamerPoolProfiles: profiles,
      brandOffers: offers,
      brandOfferMessages: messages,
      brandDeals: deals,
      brandPosts: posts,
    };
  }

  if (session.role === "streamer" && session.employeeId) {
    const eid = session.employeeId;
    const [own, offers, deals, posts] = await Promise.all([
      findStreamerPoolProfileByEmployee(eid),
      fetchBrandOffers({ employeeId: eid }),
      fetchBrandDeals({ employeeId: eid }),
      fetchBrandPosts({ employeeId: eid, limit: 2000 }),
    ]);
    const messages = await fetchBrandOfferMessagesByOfferIds(offers.map((o) => o.id));
    return {
      streamerPoolProfiles: own ? [own] : [],
      brandOffers: offers,
      brandOfferMessages: messages,
      brandDeals: deals,
      brandPosts: posts,
    };
  }

  return {
    streamerPoolProfiles: [],
    brandOffers: [],
    brandOfferMessages: [],
    brandDeals: [],
    brandPosts: [],
  };
}
