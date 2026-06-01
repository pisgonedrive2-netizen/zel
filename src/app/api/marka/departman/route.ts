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
  fetchBrandDepartments,
  findBrandDepartmentById,
  upsertBrandDepartment,
  deleteBrandDepartment,
} from "@/lib/db/brand-payroll-repo";
import type { BrandDepartment } from "@/types/brand-personnel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function scopeIds(
  session: Awaited<ReturnType<typeof getSession>>,
  requested?: string,
): string[] {
  if (!session) return [];
  if (session.role === "brand") return requested ? [requested] : accessibleBrandIds(session);
  return requested ? [requested] : [];
}

export async function GET(req: Request) {
  if (!isSupabaseEnabled()) return NextResponse.json({ departments: [] });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const requested = new URL(req.url).searchParams.get("brandId")?.trim() || undefined;
  const guard = ensureBrandAccess(session, requested ?? null, "read");
  if (guard) return guard;
  try {
    const departments = await fetchBrandDepartments(scopeIds(session, requested));
    return NextResponse.json({ departments });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Departmanlar alınamadı";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  if (!hasOrgCapability(session, "hr")) {
    return NextResponse.json({ error: "Departman yönetimi yetkisi yok" }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as Partial<BrandDepartment> | null;
  if (!body) return NextResponse.json({ error: "JSON gövdesi gerekli" }, { status: 400 });

  const requestedBrandId = String(body.brandId ?? "").trim() || null;
  const guard = ensureBrandAccess(session, requestedBrandId, "write");
  if (guard) return guard;
  const brandId = resolveBrandId(session, requestedBrandId) ?? requestedBrandId ?? "";
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });

  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name gerekli" }, { status: 400 });

  const now = new Date().toISOString();
  const isNew = !(typeof body.id === "string" && /^bd-[a-z0-9-]+$/i.test(body.id));
  const id = isNew ? `bd-${crypto.randomUUID().slice(0, 10)}` : (body.id as string);
  const department: BrandDepartment = {
    id,
    brandId,
    name,
    description: String(body.description ?? "").trim(),
    leadStaffId: String(body.leadStaffId ?? "").trim() || undefined,
    createdAt: body.createdAt ?? now,
    updatedAt: now,
  };

  try {
    const saved = await upsertBrandDepartment(department);
    await writeAudit(
      session,
      isNew ? "brand_department_created" : "brand_department_updated",
      `department=${saved.id} brand=${brandId}`,
    );
    return NextResponse.json({ department: saved });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Departman kaydedilemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  if (!hasOrgCapability(session, "hr")) {
    return NextResponse.json({ error: "Departman silme yetkisi yok" }, { status: 403 });
  }
  const id = new URL(req.url).searchParams.get("id")?.trim() ?? "";
  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });
  try {
    const dept = await findBrandDepartmentById(id);
    if (!dept) return NextResponse.json({ error: "Departman bulunamadı" }, { status: 404 });
    const guard = ensureBrandAccess(session, dept.brandId, "write");
    if (guard) return guard;
    await deleteBrandDepartment(id);
    await writeAudit(session, "brand_department_deleted", `department=${id} brand=${dept.brandId}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Departman silinemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
