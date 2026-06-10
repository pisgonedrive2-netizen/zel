import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import {
  bulkUpsertAffiliateDailyStats,
  fetchAffiliateDailyStats,
  findAffiliatePartnerById,
} from "@/lib/db/repository";
import {
  canReadAffiliate,
  canWriteAffiliate,
  ensureBrandScope,
  resolveBrandId,
} from "@/lib/affiliate-access";
import { canAccessBrandId } from "@/lib/org-access";
import type { AffiliateDailyStat } from "@/store/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_CURRENCIES = ["USD", "EUR", "TRY"] as const;
const ALLOWED_SOURCES = ["manual", "csv", "api", "webhook"] as const;

function pickEnum<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number]
): T[number] {
  const s = String(value ?? "");
  return (allowed as readonly string[]).includes(s) ? (s as T[number]) : fallback;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function newStatId(): string {
  return `ads-${crypto.randomUUID().slice(0, 10)}`;
}

/**
 * GET /api/affiliate/stats?brandId=...&partnerId=...&from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export async function GET(req: Request) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }
  if (!canReadAffiliate(session)) {
    return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
  }
  const url = new URL(req.url);
  const requestedBrandId = url.searchParams.get("brandId")?.trim() || undefined;
  const guard = ensureBrandScope(session, requestedBrandId ?? null, "read");
  if (guard) return guard;
  const partnerId = url.searchParams.get("partnerId")?.trim() || undefined;
  const from = url.searchParams.get("from")?.trim() || undefined;
  const to = url.searchParams.get("to")?.trim() || undefined;
  if (from && !ISO_DATE_RE.test(from)) {
    return NextResponse.json({ error: "from formatı YYYY-MM-DD olmalı" }, { status: 400 });
  }
  if (to && !ISO_DATE_RE.test(to)) {
    return NextResponse.json({ error: "to formatı YYYY-MM-DD olmalı" }, { status: 400 });
  }
  // partnerId verilmişse, brand role için partnerın brandId'si de doğrulanır.
  if (partnerId && session.role === "brand") {
    const partner = await findAffiliatePartnerById(partnerId);
    if (!partner || !canAccessBrandId(session, partner.brandId)) {
      return NextResponse.json({ error: "Partner için yetkili değilsiniz" }, { status: 403 });
    }
  }
  try {
    const brandId = resolveBrandId(session, requestedBrandId);
    const stats = await fetchAffiliateDailyStats({ brandId, partnerId, from, to });
    return NextResponse.json({ stats });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "İstatistik yüklenemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

interface BulkUpsertBody {
  rows: Partial<AffiliateDailyStat>[];
}

/**
 * POST /api/affiliate/stats — bulk upsert.
 * Body: { rows: AffiliateDailyStat[] } (id, createdAt, updatedAt server tarafında üretilebilir).
 * UNIQUE (partner_id, stat_date) çakışmasında günceller.
 */
export async function POST(req: Request) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }
  if (!canWriteAffiliate(session)) {
    return NextResponse.json({ error: "Yazma yetkisi yok" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as BulkUpsertBody | null;
  if (!body || !Array.isArray(body.rows)) {
    return NextResponse.json({ error: "rows[] gerekli" }, { status: 400 });
  }
  if (body.rows.length === 0) {
    return NextResponse.json({ ok: true, count: 0 });
  }
  if (body.rows.length > 5000) {
    return NextResponse.json({ error: "Tek istekte en fazla 5000 satır" }, { status: 400 });
  }

  // Partner→brand eşleştirmesini doğrula. Cache aynı istekte tekrar fetch'i önler.
  const partnerIds = [...new Set(body.rows.map((r) => String(r.partnerId ?? "").trim()).filter(Boolean))];
  const partnerCache = new Map<string, { brandId: string }>();
  for (const pid of partnerIds) {
    const p = await findAffiliatePartnerById(pid);
    if (!p) {
      return NextResponse.json({ error: `Partner bulunamadı: ${pid}` }, { status: 404 });
    }
    partnerCache.set(pid, { brandId: p.brandId });
  }

  const nowIso = new Date().toISOString();
  const errors: { index: number; reason: string }[] = [];
  const normalized: AffiliateDailyStat[] = [];

  for (let i = 0; i < body.rows.length; i += 1) {
    const r = body.rows[i] ?? {};
    const partnerId = String(r.partnerId ?? "").trim();
    if (!partnerId) {
      errors.push({ index: i, reason: "partnerId boş" });
      continue;
    }
    const partner = partnerCache.get(partnerId);
    if (!partner) {
      errors.push({ index: i, reason: "partner bulunamadı" });
      continue;
    }
    if (session.role === "brand" && !canAccessBrandId(session, partner.brandId)) {
      errors.push({ index: i, reason: "yetkisiz brand" });
      continue;
    }
    const statDate = String(r.statDate ?? "").slice(0, 10);
    if (!ISO_DATE_RE.test(statDate)) {
      errors.push({ index: i, reason: "statDate formatı YYYY-MM-DD olmalı" });
      continue;
    }
    const row: AffiliateDailyStat = {
      id: typeof r.id === "string" && r.id.trim() ? r.id.trim() : newStatId(),
      partnerId,
      brandId: partner.brandId,
      statDate,
      clicks: Math.max(0, Math.floor(Number(r.clicks) || 0)),
      registrations: Math.max(0, Math.floor(Number(r.registrations) || 0)),
      ftdCount: Math.max(0, Math.floor(Number(r.ftdCount) || 0)),
      ftdAmount: Math.max(0, Number(r.ftdAmount) || 0),
      depositAmount: Math.max(0, Number(r.depositAmount) || 0),
      withdrawalAmount: Math.max(0, Number(r.withdrawalAmount) || 0),
      netRevenue: Number(r.netRevenue) || 0,
      commissionDue: Math.max(0, Number(r.commissionDue) || 0),
      currency: pickEnum(r.currency, ALLOWED_CURRENCIES, "USD"),
      source: pickEnum(r.source, ALLOWED_SOURCES, "manual"),
      importedAt: r.importedAt ?? nowIso,
      createdAt: r.createdAt ?? nowIso,
      updatedAt: nowIso,
    };
    if (row.ftdCount > row.registrations) {
      errors.push({ index: i, reason: "ftdCount > registrations" });
      continue;
    }
    normalized.push(row);
  }

  try {
    const { count } = await bulkUpsertAffiliateDailyStats(normalized);
    return NextResponse.json({ ok: true, count, errors });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Bulk upsert başarısız";
    return NextResponse.json({ error: msg, errors }, { status: 500 });
  }
}
