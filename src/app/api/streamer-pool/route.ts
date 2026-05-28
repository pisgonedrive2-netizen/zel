import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import {
  fetchStreamerPoolProfiles,
  findStreamerPoolProfileByEmployee,
} from "@/lib/db/repository";
import type { StreamerPoolProfile } from "@/store/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_STATUS: StreamerPoolProfile["status"][] = [
  "draft",
  "published",
  "paused",
  "closed",
];

/**
 * GET /api/streamer-pool
 * Filtreler: ?category=&language=&country=&minRate=&maxRate=&status=
 *
 * - admin/auditor: tüm profiller (status filtresi verilebilir, default tümü).
 * - brand: status=published + visibility public/brand_only (uygulama filtresi).
 * - streamer: sadece kendi profili.
 */
export async function GET(req: Request) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status")?.trim();
  const category = url.searchParams.get("category")?.trim().toLowerCase() || undefined;
  const language = url.searchParams.get("language")?.trim().toLowerCase() || undefined;
  const country = url.searchParams.get("country")?.trim().toUpperCase() || undefined;
  const minRate = Number(url.searchParams.get("minRate"));
  const maxRate = Number(url.searchParams.get("maxRate"));
  const hasMin = Number.isFinite(minRate) && minRate > 0;
  const hasMax = Number.isFinite(maxRate) && maxRate > 0;

  const statusFilter =
    statusParam && (ALLOWED_STATUS as readonly string[]).includes(statusParam)
      ? (statusParam as StreamerPoolProfile["status"])
      : undefined;

  try {
    let profiles: StreamerPoolProfile[];
    if (session.role === "streamer") {
      if (!session.employeeId) return NextResponse.json({ profiles: [] });
      const own = await findStreamerPoolProfileByEmployee(session.employeeId);
      profiles = own ? [own] : [];
    } else if (session.role === "brand") {
      profiles = await fetchStreamerPoolProfiles({ brandView: true });
    } else if (session.role === "admin" || session.role === "auditor") {
      profiles = await fetchStreamerPoolProfiles({ status: statusFilter });
    } else {
      return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
    }

    const filtered = profiles.filter((p) => {
      if (category && !p.categories.map((c) => c.toLowerCase()).includes(category)) {
        return false;
      }
      if (language && !p.languages.map((l) => l.toLowerCase()).includes(language)) {
        return false;
      }
      if (country && !p.countries.map((c) => c.toUpperCase()).includes(country)) {
        return false;
      }
      if (hasMin) {
        const top = p.rateMaxUsd ?? p.rateMinUsd ?? Number.POSITIVE_INFINITY;
        if (top < minRate) return false;
      }
      if (hasMax) {
        const bottom = p.rateMinUsd ?? p.rateMaxUsd ?? 0;
        if (bottom > maxRate) return false;
      }
      return true;
    });

    return NextResponse.json({ profiles: filtered });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Profil listesi yüklenemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
