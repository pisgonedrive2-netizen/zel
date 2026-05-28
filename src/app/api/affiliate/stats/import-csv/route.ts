import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import {
  bulkUpsertAffiliateDailyStats,
  fetchAffiliateDailyStats,
  fetchAffiliatePartners,
} from "@/lib/db/repository";
import {
  canWriteAffiliate,
  ensureBrandScope,
  resolveBrandId,
  writeAffiliateAudit,
} from "@/lib/affiliate-access";
import type { AffiliateDailyStat, AffiliatePartner } from "@/store/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Şablon (tek satır başlık zorunlu):
 *   partner_external_ref,date,clicks,registrations,ftd_count,ftd_amount,deposit,withdrawal,currency
 *
 * Notlar:
 *   - `partner_external_ref` `affiliate_partners.external_ref` ile match'lenir.
 *   - Eşleşmeyen satırlar `errors[]` listesine eklenir, skip edilir.
 *   - Tarih `YYYY-MM-DD` zorunlu.
 *   - `currency` opsiyonel; eksikse partner default'u kullanılır.
 *   - Basit parser: tırnak/escape desteklemez; ileride PR.
 */

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_CURRENCIES = new Set(["USD", "EUR", "TRY"]);
const REQUIRED_HEADERS = [
  "partner_external_ref",
  "date",
  "clicks",
  "registrations",
  "ftd_count",
  "ftd_amount",
  "deposit",
  "withdrawal",
] as const;

interface CsvParseResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: { line: number; reason: string }[];
}

function newStatId(): string {
  return `ads-${crypto.randomUUID().slice(0, 10)}`;
}

async function readCsvBody(req: Request): Promise<string | null> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (file && typeof file !== "string") {
      return await (file as Blob).text();
    }
    const inline = form.get("csv");
    return typeof inline === "string" ? inline : null;
  }
  if (contentType.includes("application/json")) {
    const body = (await req.json().catch(() => null)) as { csv?: string } | null;
    return body?.csv ?? null;
  }
  return await req.text();
}

function parseNumber(value: string, fallback = 0): number {
  if (!value) return fallback;
  const cleaned = value.replace(/\s/g, "").replace(/,/g, ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : fallback;
}

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

  const url = new URL(req.url);
  const requestedBrandId = url.searchParams.get("brandId")?.trim() || undefined;
  const guard = ensureBrandScope(session, requestedBrandId ?? null, "write");
  if (guard) return guard;
  const brandId = resolveBrandId(session, requestedBrandId);
  if (session.role === "brand" && !brandId) {
    return NextResponse.json({ error: "brandId zorunlu" }, { status: 400 });
  }

  const csv = await readCsvBody(req);
  if (!csv || !csv.trim()) {
    return NextResponse.json({ error: "CSV gövdesi boş" }, { status: 400 });
  }

  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) {
    return NextResponse.json({ error: "CSV boş" }, { status: 400 });
  }

  const header = lines[0].split(",").map((c) => c.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  for (const required of REQUIRED_HEADERS) {
    if (idx(required) === -1) {
      return NextResponse.json(
        { error: `Eksik sütun: ${required}. Şablon: ${REQUIRED_HEADERS.join(",")}` },
        { status: 400 }
      );
    }
  }
  const currencyIdx = idx("currency");

  // Brand role → kendi brandId; admin için brandId query yoksa tüm partner'lar fetch'lenir.
  const partners: AffiliatePartner[] = await fetchAffiliatePartners(brandId);
  if (partners.length === 0) {
    return NextResponse.json(
      { error: "Eşleşecek partner bulunamadı (brand boş)", inserted: 0, updated: 0, skipped: 0, errors: [] },
      { status: 404 }
    );
  }
  const partnerByRef = new Map<string, AffiliatePartner>();
  for (const p of partners) {
    if (p.externalRef) partnerByRef.set(p.externalRef.toLowerCase(), p);
  }

  // Mevcut (partner_id, stat_date) çiftlerini önceden çek → inserted/updated ayrımı için.
  const existingKey = new Set<string>();
  try {
    const existing = await fetchAffiliateDailyStats({
      brandId,
      limit: 20000,
    });
    for (const s of existing) existingKey.add(`${s.partnerId}|${s.statDate}`);
  } catch {
    /* opsiyonel — boş kabul edilir */
  }

  const nowIso = new Date().toISOString();
  const out: CsvParseResult = { inserted: 0, updated: 0, skipped: 0, errors: [] };
  const rows: AffiliateDailyStat[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const lineNumber = i + 1;
    const cols = lines[i].split(",").map((c) => c.trim());
    const externalRef = cols[idx("partner_external_ref")]?.toLowerCase() ?? "";
    if (!externalRef) {
      out.skipped += 1;
      out.errors.push({ line: lineNumber, reason: "partner_external_ref boş" });
      continue;
    }
    const partner = partnerByRef.get(externalRef);
    if (!partner) {
      out.skipped += 1;
      out.errors.push({ line: lineNumber, reason: `partner bulunamadı: ${externalRef}` });
      continue;
    }
    const statDate = cols[idx("date")] ?? "";
    if (!ISO_DATE_RE.test(statDate)) {
      out.skipped += 1;
      out.errors.push({ line: lineNumber, reason: `tarih YYYY-MM-DD olmalı: ${statDate}` });
      continue;
    }
    const clicks = Math.max(0, Math.floor(parseNumber(cols[idx("clicks")] ?? "0")));
    const registrations = Math.max(0, Math.floor(parseNumber(cols[idx("registrations")] ?? "0")));
    const ftdCount = Math.max(0, Math.floor(parseNumber(cols[idx("ftd_count")] ?? "0")));
    if (ftdCount > registrations) {
      out.skipped += 1;
      out.errors.push({ line: lineNumber, reason: "ftd_count > registrations" });
      continue;
    }
    const ftdAmount = Math.max(0, parseNumber(cols[idx("ftd_amount")] ?? "0"));
    const depositAmount = Math.max(0, parseNumber(cols[idx("deposit")] ?? "0"));
    const withdrawalAmount = Math.max(0, parseNumber(cols[idx("withdrawal")] ?? "0"));
    const currencyRaw = currencyIdx >= 0 ? (cols[currencyIdx] ?? "").toUpperCase() : partner.currency;
    const currency = (ALLOWED_CURRENCIES.has(currencyRaw) ? currencyRaw : partner.currency) as
      | "USD"
      | "EUR"
      | "TRY";

    const isUpdate = existingKey.has(`${partner.id}|${statDate}`);
    if (isUpdate) out.updated += 1;
    else out.inserted += 1;

    rows.push({
      id: newStatId(),
      partnerId: partner.id,
      brandId: partner.brandId,
      statDate,
      clicks,
      registrations,
      ftdCount,
      ftdAmount,
      depositAmount,
      withdrawalAmount,
      netRevenue: depositAmount - withdrawalAmount,
      commissionDue: 0,
      currency,
      source: "csv",
      importedAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }

  if (rows.length === 0) {
    return NextResponse.json({ ...out, ok: out.errors.length === 0 }, { status: 200 });
  }

  try {
    await bulkUpsertAffiliateDailyStats(rows);
    await writeAffiliateAudit(
      session,
      "affiliate_csv_imported",
      `brand=${brandId ?? "all"} inserted=${out.inserted} updated=${out.updated} skipped=${out.skipped}`
    );
    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "CSV import başarısız";
    return NextResponse.json({ error: msg, ...out }, { status: 500 });
  }
}
