import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import {
  findBrandRegistrationRequestById,
  updateBrandRegistrationRequest,
} from "@/lib/db/repository";

export const runtime = "nodejs";

type PatchBody = {
  brandName?: string;
  shortName?: string;
  category?: string;
  website?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  telegram?: string;
  monthlyVolume?: string;
  preferredUsername?: string;
  notes?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Boş string → null (opsiyonel alanları temizleyebilmek için). */
function optional(v: string | undefined): string | null | undefined {
  if (v === undefined) return undefined;
  const trimmed = v.trim();
  return trimmed === "" ? null : trimmed;
}

export async function PATCH(
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

  const body = (await req.json().catch(() => null)) as PatchBody | null;
  if (!body) {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    const reqRow = await findBrandRegistrationRequestById(id);
    if (!reqRow) {
      return NextResponse.json({ error: "Başvuru bulunamadı." }, { status: 404 });
    }
    if (reqRow.status !== "pending") {
      return NextResponse.json(
        { error: "Yalnızca bekleyen başvurular düzenlenebilir." },
        { status: 409 },
      );
    }

    const patch: Parameters<typeof updateBrandRegistrationRequest>[1] = {};

    if (body.brandName !== undefined) {
      const v = body.brandName.trim();
      if (!v) {
        return NextResponse.json({ error: "Marka adı boş olamaz." }, { status: 400 });
      }
      patch.brandName = v;
    }
    if (body.contactName !== undefined) {
      const v = body.contactName.trim();
      if (!v) {
        return NextResponse.json({ error: "İletişim kişisi boş olamaz." }, { status: 400 });
      }
      patch.contactName = v;
    }
    if (body.contactEmail !== undefined) {
      const v = body.contactEmail.trim().toLowerCase();
      if (!v || !EMAIL_RE.test(v)) {
        return NextResponse.json({ error: "Geçerli bir e-posta adresi girin." }, { status: 400 });
      }
      patch.contactEmail = v;
    }
    if (body.category !== undefined) {
      patch.category = body.category.trim() || "Bahis";
    }
    if (body.notes !== undefined) {
      patch.notes = body.notes.trim();
    }
    if (body.shortName !== undefined) patch.shortName = optional(body.shortName) ?? null;
    if (body.website !== undefined) patch.website = optional(body.website) ?? null;
    if (body.contactPhone !== undefined) patch.contactPhone = optional(body.contactPhone) ?? null;
    if (body.telegram !== undefined) patch.telegram = optional(body.telegram) ?? null;
    if (body.monthlyVolume !== undefined) patch.monthlyVolume = optional(body.monthlyVolume) ?? null;
    if (body.preferredUsername !== undefined) {
      const raw = body.preferredUsername.trim().toLowerCase();
      patch.preferredUsername = raw === "" ? null : raw;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: true, request: reqRow });
    }

    const updated = await updateBrandRegistrationRequest(reqRow.id, patch);

    try {
      await getSupabaseAdmin().from("audit_logs").insert({
        actor_id: session.userId,
        actor_name: session.name,
        action: "brand_registration_edited",
        detail: `${updated.brandName} (req=${updated.id}) — alanlar: ${Object.keys(patch).join(", ")}`,
      });
    } catch {
      /* audit hatası akışı kesmesin */
    }

    return NextResponse.json({ ok: true, request: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Düzenleme sırasında hata.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
