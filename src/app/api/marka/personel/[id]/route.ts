import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { ensureBrandAccess, hasOrgCapability, writeAudit } from "@/lib/org-access";
import {
  findBrandStaffById,
  deleteBrandStaff,
  fetchBrandActivity,
  fetchBrandTasks,
  fetchBrandShifts,
  insertBrandActivity,
} from "@/lib/db/brand-personnel-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const { id } = await ctx.params;

  try {
    const staff = await findBrandStaffById(id);
    if (!staff) return NextResponse.json({ error: "Personel bulunamadı" }, { status: 404 });
    const guard = ensureBrandAccess(session, staff.brandId, "read");
    if (guard) return guard;

    const [activity, tasks, shifts] = await Promise.all([
      fetchBrandActivity([staff.brandId], id).catch(() => []),
      fetchBrandTasks([staff.brandId]).catch(() => []),
      fetchBrandShifts([staff.brandId]).catch(() => []),
    ]);
    return NextResponse.json({
      staff,
      activity,
      tasks: tasks.filter((t) => t.staffId === id),
      shifts: shifts.filter((s) => s.staffId === id),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Personel detayı alınamadı";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  if (!hasOrgCapability(session, "hr")) {
    return NextResponse.json({ error: "Personel silme yetkisi yok" }, { status: 403 });
  }
  const { id } = await ctx.params;

  try {
    const staff = await findBrandStaffById(id);
    if (!staff) return NextResponse.json({ error: "Personel bulunamadı" }, { status: 404 });
    const guard = ensureBrandAccess(session, staff.brandId, "write");
    if (guard) return guard;
    await insertBrandActivity({
      brandId: staff.brandId,
      actorUserId: session.userId,
      actorName: session.name,
      type: "staff_deleted",
      detail: `${staff.name} personeli silindi`,
    }).catch(() => {});
    await deleteBrandStaff(id);
    await writeAudit(session, "brand_staff_deleted", `staff=${id} brand=${staff.brandId}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Personel silinemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
