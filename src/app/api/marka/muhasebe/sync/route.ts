import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import {
  ensureBrandAccess, resolveBrandId, hasOrgCapability, writeAudit,
} from "@/lib/org-access";
import { fetchAffiliatePayouts } from "@/lib/db/repository";
import { fetchCrmDeals } from "@/lib/db/crm-repo";
import { fetchBrandStaff } from "@/lib/db/brand-personnel-repo";
import { insertAutoLedgerEntries } from "@/lib/db/brand-accounting-repo";
import type { BrandLedgerEntry } from "@/types/brand-accounting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/marka/muhasebe/sync
 * Otomatik defter beslemesi:
 *  - Ödenen affiliate payout'ları → gider
 *  - Kazanılan CRM anlaşmaları → gelir
 *  - Aktif personelin aylık maliyeti → gider (içinde bulunulan ay)
 * (brand, source, ref_id) tekil olduğu için tekrarlanan girişler yoksayılır.
 */
export async function POST(req: Request) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  if (!hasOrgCapability(session, "finance")) {
    return NextResponse.json({ error: "Muhasebe yetkisi yok" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { brandId?: string };
  const requestedBrandId = String(body.brandId ?? "").trim() || null;
  const guard = ensureBrandAccess(session, requestedBrandId, "write");
  if (guard) return guard;
  const brandId = resolveBrandId(session, requestedBrandId) ?? requestedBrandId ?? "";
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });

  const now = new Date().toISOString();
  const ym = now.slice(0, 7);
  const today = now.slice(0, 10);
  const entries: BrandLedgerEntry[] = [];

  try {
    // 1) Ödenen affiliate payout'lar → gider
    const payouts = await fetchAffiliatePayouts(brandId).catch(() => []);
    for (const p of payouts) {
      if (p.status !== "paid") continue;
      entries.push({
        id: `le-ap-${p.id}`.slice(0, 48),
        brandId,
        entryDate: p.paidDate || p.periodEnd || today,
        direction: "expense",
        category: "affiliate",
        description: `Affiliate ödeme · ${p.periodStart}–${p.periodEnd}`,
        amount: p.amount,
        currency: p.currency,
        source: "affiliate_payout",
        refId: p.id,
        createdBy: session.userId,
        createdAt: now,
        updatedAt: now,
      });
    }

    // 2) Kazanılan CRM anlaşmaları → gelir
    const deals = await fetchCrmDeals([brandId]).catch(() => []);
    for (const d of deals) {
      if (d.stage !== "won" || d.value <= 0) continue;
      entries.push({
        id: `le-cd-${d.id}`.slice(0, 48),
        brandId,
        entryDate: d.expectedClose || today,
        direction: "income",
        category: "crm",
        description: `Kazanılan anlaşma · ${d.title}`,
        amount: d.value,
        currency: d.currency,
        source: "crm_deal",
        refId: d.id,
        createdBy: session.userId,
        createdAt: now,
        updatedAt: now,
      });
    }

    // 3) Aktif personel aylık maliyeti → gider (bu ay; ref ay bazlı tekilleştirilir)
    const staff = await fetchBrandStaff([brandId]).catch(() => []);
    for (const s of staff) {
      if (s.status !== "active" || s.monthlyCost <= 0) continue;
      entries.push({
        id: `le-sc-${s.id}-${ym}`.slice(0, 48),
        brandId,
        entryDate: today,
        direction: "expense",
        category: "payroll",
        description: `Personel maliyeti · ${s.name} (${ym})`,
        amount: s.monthlyCost,
        currency: s.currency,
        source: "staff_cost",
        refId: `${s.id}-${ym}`,
        createdBy: session.userId,
        createdAt: now,
        updatedAt: now,
      });
    }

    const inserted = await insertAutoLedgerEntries(entries);
    await writeAudit(session, "brand_ledger_synced", `brand=${brandId} candidates=${entries.length} inserted=${inserted}`);
    return NextResponse.json({ ok: true, candidates: entries.length, inserted });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Senkronizasyon başarısız";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
