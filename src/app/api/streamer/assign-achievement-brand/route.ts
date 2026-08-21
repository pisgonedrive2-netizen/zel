import { NextRequest, NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import {
  assignAchievementItemsToBrand,
  type AchievementAssignItem,
} from "@/lib/social-api/assign-achievement-brand";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_ITEMS = 80;

function canAssignBrand(
  role: string,
  sessionBrandId: string | undefined,
  sessionBrandIds: string[] | undefined,
  brandId: string
): boolean {
  if (role === "admin" || role === "auditor") return true;
  if (role === "streamer") return true;
  if (role === "brand") {
    if (sessionBrandId === brandId) return true;
    return Boolean(sessionBrandIds?.includes(brandId));
  }
  return false;
}

/**
 * POST /api/streamer/assign-achievement-brand
 * Achievement günündeki paylaşımları marka izlenme sayfasına yazar.
 */
export async function POST(req: NextRequest) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });

  let body: {
    employeeId?: string;
    brandId?: string;
    date?: string;
    items?: AchievementAssignItem[];
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const brandId = body.brandId?.trim() ?? "";
  const date = body.date?.trim() ?? "";
  const items = Array.isArray(body.items) ? body.items.slice(0, MAX_ITEMS) : [];

  if (!brandId || !/^\d{4}-\d{2}-\d{2}$/.test(date) || items.length === 0) {
    return NextResponse.json(
      { error: "brandId, date (YYYY-MM-DD) ve items gerekli" },
      { status: 400 }
    );
  }

  if (!canAssignBrand(session.role, session.brandId, session.brandIds, brandId)) {
    return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
  }

  let employeeId = session.employeeId ?? "";
  const queryEid = body.employeeId?.trim();
  if (session.role === "admin" || session.role === "auditor" || session.role === "brand") {
    employeeId = queryEid || employeeId;
  } else if (session.role === "streamer") {
    employeeId = session.employeeId ?? "";
  } else {
    return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
  }

  if (!employeeId) {
    return NextResponse.json({ error: "employeeId gerekli" }, { status: 400 });
  }

  const result = await assignAchievementItemsToBrand({
    employeeId,
    brandId,
    date,
    items,
  });

  return NextResponse.json({ ok: result.assigned > 0, ...result });
}
