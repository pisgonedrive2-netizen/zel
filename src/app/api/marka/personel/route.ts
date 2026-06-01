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
  fetchBrandStaff,
  upsertBrandStaff,
  insertBrandActivity,
} from "@/lib/db/brand-personnel-repo";
import type { BrandStaff, StaffCurrency, StaffStatus } from "@/types/brand-personnel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS: readonly StaffStatus[] = ["active", "passive", "invited"];
const CURRENCY: readonly StaffCurrency[] = ["USD", "EUR", "TRY"];
function pick<T extends string>(v: unknown, allowed: readonly T[], fb: T): T {
  const s = String(v ?? "");
  return (allowed as readonly string[]).includes(s) ? (s as T) : fb;
}

export async function GET(req: Request) {
  if (!isSupabaseEnabled()) return NextResponse.json({ staff: [] });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const requested = new URL(req.url).searchParams.get("brandId")?.trim() || undefined;
  const guard = ensureBrandAccess(session, requested ?? null, "read");
  if (guard) return guard;
  try {
    const ids =
      session.role === "brand"
        ? requested
          ? [requested]
          : accessibleBrandIds(session)
        : requested
          ? [requested]
          : [];
    const staff = await fetchBrandStaff(ids);
    return NextResponse.json({ staff });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Personel listesi alınamadı";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  if (!hasOrgCapability(session, "hr")) {
    return NextResponse.json({ error: "Personel yönetimi yetkisi yok" }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as Partial<BrandStaff> | null;
  if (!body) return NextResponse.json({ error: "JSON gövdesi gerekli" }, { status: 400 });

  const requestedBrandId = String(body.brandId ?? "").trim() || null;
  const guard = ensureBrandAccess(session, requestedBrandId, "write");
  if (guard) return guard;
  const brandId = resolveBrandId(session, requestedBrandId) ?? requestedBrandId ?? "";
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });

  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name gerekli" }, { status: 400 });

  const now = new Date().toISOString();
  const isNew = !(typeof body.id === "string" && /^bs-[a-z0-9-]+$/i.test(body.id));
  const id = isNew ? `bs-${crypto.randomUUID().slice(0, 10)}` : (body.id as string);
  const staff: BrandStaff = {
    id,
    brandId,
    name,
    role: String(body.role ?? "").trim(),
    email: body.email?.trim() || undefined,
    phone: body.phone?.trim() || undefined,
    status: pick(body.status, STATUS, "active"),
    monthlyCost: Math.max(0, Number(body.monthlyCost) || 0),
    currency: pick(body.currency, CURRENCY, "USD"),
    avatar: body.avatar?.trim() || name.slice(0, 1).toUpperCase(),
    notes: body.notes ?? "",
    departmentId: String(body.departmentId ?? "").trim() || undefined,
    baseSalary: Math.max(0, Number(body.baseSalary) || 0),
    rentSupport: Math.max(0, Number(body.rentSupport) || 0),
    mealAllowance: Math.max(0, Number(body.mealAllowance) || 0),
    createdAt: body.createdAt ?? now,
    updatedAt: now,
  };

  try {
    const saved = await upsertBrandStaff(staff);
    await insertBrandActivity({
      brandId,
      staffId: saved.id,
      actorUserId: session.userId,
      actorName: session.name,
      type: isNew ? "staff_created" : "staff_updated",
      detail: isNew ? `${saved.name} personeli eklendi` : `${saved.name} bilgileri güncellendi`,
    }).catch(() => {});
    await writeAudit(session, isNew ? "brand_staff_created" : "brand_staff_updated", `staff=${saved.id} brand=${brandId}`);
    return NextResponse.json({ staff: saved });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Personel kaydedilemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
