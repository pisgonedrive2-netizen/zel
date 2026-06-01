import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import {
  ensureBrandAccess,
  resolveBrandId,
  accessibleBrandIds,
  hasOrgCapability,
  writeAudit,
} from "@/lib/org-access";
import {
  fetchBrandPayrollItems,
  findBrandPayrollItemById,
  upsertBrandPayrollItem,
  deleteBrandPayrollItem,
  setStaffMonthPaid,
} from "@/lib/db/brand-payroll-repo";
import type { BrandPayrollItem, PayrollItemType, StaffCurrency } from "@/types/brand-personnel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CURRENCY: readonly StaffCurrency[] = ["USD", "EUR", "TRY"];
const PAYROLL_TYPES: readonly PayrollItemType[] = [
  "advance", "bonus", "deduction", "rent", "meal", "other",
];
function pick<T extends string>(v: unknown, allowed: readonly T[], fb: T): T {
  const s = String(v ?? "");
  return (allowed as readonly string[]).includes(s) ? (s as T) : fb;
}
function isMonth(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}$/.test(v);
}
function scopeIds(
  session: Awaited<ReturnType<typeof getSession>>,
  requested?: string,
): string[] {
  if (!session) return [];
  if (session.role === "brand") return requested ? [requested] : accessibleBrandIds(session);
  return requested ? [requested] : [];
}

export async function GET(req: Request) {
  if (!isSupabaseEnabled()) return NextResponse.json({ items: [] });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  if (!hasOrgCapability(session, "finance")) {
    return NextResponse.json({ error: "Bordro görüntüleme yetkisi yok" }, { status: 403 });
  }
  const url = new URL(req.url);
  const requested = url.searchParams.get("brandId")?.trim() || undefined;
  const month = url.searchParams.get("month")?.trim() || undefined;
  const guard = ensureBrandAccess(session, requested ?? null, "read");
  if (guard) return guard;
  try {
    const items = await fetchBrandPayrollItems(
      scopeIds(session, requested),
      isMonth(month) ? month : undefined,
    );
    return NextResponse.json({ items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Bordro verisi alınamadı";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  if (!hasOrgCapability(session, "finance")) {
    return NextResponse.json({ error: "Bordro yetkisi yok" }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as (Record<string, unknown> & { kind?: string }) | null;
  if (!body) return NextResponse.json({ error: "JSON gövdesi gerekli" }, { status: 400 });

  const requestedBrandId = String(body.brandId ?? "").trim() || null;
  const guard = ensureBrandAccess(session, requestedBrandId, "write");
  if (guard) return guard;
  const brandId = resolveBrandId(session, requestedBrandId) ?? requestedBrandId ?? "";
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });

  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  try {
    // Bir personelin ay bazlı tüm kalemlerini ödendi/bekliyor işaretle.
    if (body.kind === "mark_paid") {
      const staffId = String(body.staffId ?? "").trim();
      const month = String(body.month ?? "").trim();
      if (!staffId || !isMonth(month)) {
        return NextResponse.json({ error: "staffId ve geçerli month gerekli" }, { status: 400 });
      }
      const paid = body.paid !== false;
      await setStaffMonthPaid(brandId, staffId, month, paid, paid ? today : null);
      await writeAudit(session, "brand_payroll_mark_paid", `staff=${staffId} brand=${brandId} month=${month} paid=${paid}`);
      return NextResponse.json({ ok: true });
    }

    const month = String(body.month ?? "").trim();
    if (!isMonth(month)) return NextResponse.json({ error: "Geçerli month (YYYY-MM) gerekli" }, { status: 400 });
    const staffId = String(body.staffId ?? "").trim();
    if (!staffId) return NextResponse.json({ error: "staffId gerekli" }, { status: 400 });

    const isNew = !(typeof body.id === "string" && /^bpi-[a-z0-9-]+$/i.test(body.id as string));
    const paid = body.paid === true;
    const item: BrandPayrollItem = {
      id: isNew ? `bpi-${crypto.randomUUID().slice(0, 10)}` : (body.id as string),
      brandId,
      staffId,
      month,
      type: pick(body.type, PAYROLL_TYPES, "other"),
      amount: Math.max(0, Number(body.amount) || 0),
      currency: pick(body.currency, CURRENCY, "USD"),
      description: String(body.description ?? "").trim(),
      paid,
      paidDate: paid ? (String(body.paidDate ?? "").trim() || today) : undefined,
      createdAt: (body.createdAt as string) ?? now,
      updatedAt: now,
    };
    const saved = await upsertBrandPayrollItem(item);
    await writeAudit(
      session,
      isNew ? "brand_payroll_created" : "brand_payroll_updated",
      `item=${saved.id} brand=${brandId} staff=${staffId} ${saved.type} ${saved.amount}`,
    );
    return NextResponse.json({ item: saved });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Bordro kaydedilemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  if (!hasOrgCapability(session, "finance")) {
    return NextResponse.json({ error: "Silme yetkisi yok" }, { status: 403 });
  }
  const id = new URL(req.url).searchParams.get("id")?.trim() ?? "";
  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });
  try {
    const existing = await findBrandPayrollItemById(id);
    if (existing) {
      const g = ensureBrandAccess(session, existing.brandId, "write");
      if (g) return g;
    }
    await deleteBrandPayrollItem(id);
    await writeAudit(session, "brand_payroll_deleted", `item=${id}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Silme başarısız";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
