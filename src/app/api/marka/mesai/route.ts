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
  fetchBrandAttendance,
  findAttendanceForDay,
  upsertBrandAttendance,
  deleteBrandAttendance,
  insertBrandActivity,
} from "@/lib/db/brand-personnel-repo";
import type { AttendanceAction, BrandStaffAttendance } from "@/types/brand-personnel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// GET — marka mesai kayıtları (varsayılan: son 30 gün veya ?from/?to/?staffId).
export async function GET(req: Request) {
  if (!isSupabaseEnabled()) return NextResponse.json({ attendance: [] });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const url = new URL(req.url);
  const requested = url.searchParams.get("brandId")?.trim() || undefined;
  const guard = ensureBrandAccess(session, requested ?? null, "read");
  if (guard) return guard;
  const ids =
    session.role === "brand"
      ? requested ? [requested] : accessibleBrandIds(session)
      : requested ? [requested] : [];
  try {
    const attendance = await fetchBrandAttendance(ids, {
      fromDate: url.searchParams.get("from")?.trim() || undefined,
      toDate: url.searchParams.get("to")?.trim() || undefined,
      staffId: url.searchParams.get("staffId")?.trim() || undefined,
    });
    return NextResponse.json({ attendance });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Mesai verisi alınamadı";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST — puantaj aksiyonu (check_in / break_start / break_end / check_out) veya manuel kayıt.
export async function POST(req: Request) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  if (!hasOrgCapability(session, "hr")) {
    return NextResponse.json({ error: "Mesai yönetimi yetkisi yok" }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "JSON gövdesi gerekli" }, { status: 400 });

  const requestedBrandId = String(body.brandId ?? "").trim() || null;
  const guard = ensureBrandAccess(session, requestedBrandId, "write");
  if (guard) return guard;
  const brandId = resolveBrandId(session, requestedBrandId) ?? requestedBrandId ?? "";
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });

  const staffId = String(body.staffId ?? "").trim();
  if (!staffId) return NextResponse.json({ error: "staffId gerekli" }, { status: 400 });

  const workDate = String(body.workDate ?? "").trim() || todayLocal();
  const action = String(body.action ?? "") as AttendanceAction | "";
  const nowIso = new Date().toISOString();

  try {
    const existing = await findAttendanceForDay(brandId, staffId, workDate);
    const base: BrandStaffAttendance = existing ?? {
      id: `att-${crypto.randomUUID().slice(0, 12)}`,
      brandId,
      staffId,
      workDate,
      status: "out",
      breakMinutes: 0,
      note: String(body.note ?? ""),
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    let next = { ...base };
    let activityDetail = "";

    switch (action) {
      case "check_in":
        if (next.status !== "out" || next.checkIn) {
          // Zaten giriş yapılmış; idempotent davran.
        }
        next.checkIn = next.checkIn ?? nowIso;
        next.status = "in";
        next.checkOut = undefined;
        activityDetail = "mesai girişi";
        break;
      case "break_start":
        if (next.status !== "in") {
          return NextResponse.json({ error: "Mola başlatmak için mesaide olmalı." }, { status: 400 });
        }
        next.status = "on_break";
        next.breakStartedAt = nowIso;
        activityDetail = "mola başladı";
        break;
      case "break_end": {
        if (next.status !== "on_break" || !next.breakStartedAt) {
          return NextResponse.json({ error: "Aktif mola yok." }, { status: 400 });
        }
        const mins = Math.max(0, Math.round((Date.now() - new Date(next.breakStartedAt).getTime()) / 60000));
        next.breakMinutes += mins;
        next.breakStartedAt = undefined;
        next.status = "in";
        activityDetail = `moladan dönüş (+${mins} dk)`;
        break;
      }
      case "check_out": {
        // Molada çıkış yaparsa molayı kapat.
        if (next.status === "on_break" && next.breakStartedAt) {
          const mins = Math.max(0, Math.round((Date.now() - new Date(next.breakStartedAt).getTime()) / 60000));
          next.breakMinutes += mins;
          next.breakStartedAt = undefined;
        }
        next.checkOut = nowIso;
        next.status = "out";
        activityDetail = "mesai çıkışı";
        break;
      }
      default: {
        // Manuel düzenleme (saat/mola/not).
        if (typeof body.checkIn === "string") next.checkIn = body.checkIn || undefined;
        if (typeof body.checkOut === "string") next.checkOut = body.checkOut || undefined;
        if (typeof body.breakMinutes === "number") next.breakMinutes = Math.max(0, Math.round(body.breakMinutes));
        if (typeof body.note === "string") next.note = body.note;
        if (typeof body.status === "string" && ["in", "on_break", "out"].includes(body.status)) {
          next.status = body.status as BrandStaffAttendance["status"];
        }
        activityDetail = "mesai kaydı düzenlendi";
      }
    }

    const saved = await upsertBrandAttendance(next);
    await insertBrandActivity({
      brandId,
      staffId,
      actorUserId: session.userId,
      actorName: session.name,
      type: "attendance",
      detail: `${activityDetail} · ${workDate}`,
    }).catch(() => {});
    await writeAudit(session, "brand_attendance", `${action || "edit"} staff=${staffId} brand=${brandId}`);
    return NextResponse.json({ attendance: saved });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Mesai kaydedilemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  if (!hasOrgCapability(session, "hr")) {
    return NextResponse.json({ error: "Silme yetkisi yok" }, { status: 403 });
  }
  const id = new URL(req.url).searchParams.get("id")?.trim() ?? "";
  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });
  try {
    await deleteBrandAttendance(id);
    await writeAudit(session, "brand_attendance_deleted", `id=${id}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Silinemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
