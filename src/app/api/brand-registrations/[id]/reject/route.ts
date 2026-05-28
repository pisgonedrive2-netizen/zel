import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import {
  findBrandRegistrationRequestById,
  updateBrandRegistrationRequest,
} from "@/lib/db/repository";

export const runtime = "nodejs";

type Body = { reason?: string };

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json(
      { error: "Supabase yapılandırılmamış." },
      { status: 503 },
    );
  }
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "Başvuru id zorunlu." }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const reason = body.reason?.trim() ?? "";
  if (!reason) {
    return NextResponse.json(
      { error: "Red sebebi (reason) zorunlu." },
      { status: 400 },
    );
  }

  try {
    const reqRow = await findBrandRegistrationRequestById(id);
    if (!reqRow) {
      return NextResponse.json({ error: "Başvuru bulunamadı." }, { status: 404 });
    }
    if (reqRow.status === "approved") {
      return NextResponse.json(
        { error: "Onaylanmış başvuru reddedilemez." },
        { status: 409 },
      );
    }
    if (reqRow.status === "rejected") {
      return NextResponse.json(
        { error: "Bu başvuru zaten reddedilmiş." },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();
    const updated = await updateBrandRegistrationRequest(reqRow.id, {
      status: "rejected",
      reviewedBy: session.userId,
      reviewedAt: now,
      rejectionReason: reason,
    });

    try {
      await getSupabaseAdmin().from("audit_logs").insert({
        actor_id: session.userId,
        actor_name: session.name,
        action: "brand_registration_rejected",
        detail: `${reqRow.brandName} (req=${reqRow.id}) — sebep: ${reason}`,
      });
    } catch {
      /* audit hatası akışı kesmesin */
    }

    return NextResponse.json({ ok: true, request: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Red sırasında hata.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
