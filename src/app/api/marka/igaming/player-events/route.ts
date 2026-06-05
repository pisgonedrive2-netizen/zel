import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import {
  ensureBrandAccess,
  resolveBrandId,
  hasOrgCapability,
  writeAudit,
} from "@/lib/org-access";
import {
  fetchBrandPlayerEvents,
  upsertBrandPlayerEventsBatch,
} from "@/lib/db/brand-igaming-repo";
import { writeBrandIgamingAudit } from "@/lib/brand-igaming-audit";
import type {
  BrandPlayerEvent,
  IgamingCurrency,
  PlayerEventChannel,
  PlayerEventSource,
  PlayerEventType,
} from "@/types/brand-igaming";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EVENT_TYPES: readonly PlayerEventType[] = [
  "registration", "ftd", "deposit", "withdrawal", "chargeback", "active_player",
];
const CHANNELS: readonly PlayerEventChannel[] = ["all", "affiliate", "organic", "influencer"];
const CURRENCIES: readonly IgamingCurrency[] = ["USD", "EUR", "TRY"];
const SOURCES: readonly PlayerEventSource[] = ["manual", "csv", "api", "webhook"];

function pick<T extends string>(v: unknown, allowed: readonly T[], fb: T): T {
  const s = String(v ?? "");
  return (allowed as readonly string[]).includes(s) ? (s as T) : fb;
}

export async function GET(req: Request) {
  if (!isSupabaseEnabled()) return NextResponse.json({ events: [] });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });

  const url = new URL(req.url);
  const requested = url.searchParams.get("brandId")?.trim() || undefined;
  const from = url.searchParams.get("from")?.trim() || undefined;
  const to = url.searchParams.get("to")?.trim() || undefined;
  const guard = ensureBrandAccess(session, requested ?? null, "read");
  if (guard) return guard;

  const brandId = resolveBrandId(session, requested);
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });
  if (from && !ISO_DATE_RE.test(from)) {
    return NextResponse.json({ error: "from formatı YYYY-MM-DD olmalı" }, { status: 400 });
  }
  if (to && !ISO_DATE_RE.test(to)) {
    return NextResponse.json({ error: "to formatı YYYY-MM-DD olmalı" }, { status: 400 });
  }

  try {
    const events = await fetchBrandPlayerEvents(brandId, from, to);
    return NextResponse.json({ events });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Oyuncu olayları alınamadı";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

interface BatchBody {
  brandId?: string;
  events?: Partial<BrandPlayerEvent>[];
}

export async function POST(req: Request) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  if (!hasOrgCapability(session, "affiliate_api")) {
    return NextResponse.json({ error: "Oyuncu verisi yazma yetkisi yok" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as BatchBody | null;
  if (!body || !Array.isArray(body.events)) {
    return NextResponse.json({ error: "events[] gerekli" }, { status: 400 });
  }
  if (body.events.length === 0) return NextResponse.json({ ok: true, count: 0 });
  if (body.events.length > 5000) {
    return NextResponse.json({ error: "Tek istekte en fazla 5000 satır" }, { status: 400 });
  }

  const requestedBrandId = String(body.brandId ?? "").trim() || null;
  const guard = ensureBrandAccess(session, requestedBrandId, "write");
  if (guard) return guard;
  const brandId = resolveBrandId(session, requestedBrandId) ?? requestedBrandId ?? "";
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });

  const now = new Date().toISOString();
  const normalized: BrandPlayerEvent[] = [];

  for (let i = 0; i < body.events.length; i += 1) {
    const r = body.events[i] ?? {};
    const eventDate = String(r.eventDate ?? "").slice(0, 10);
    if (!ISO_DATE_RE.test(eventDate)) continue;
    normalized.push({
      id:
        typeof r.id === "string" && r.id.trim()
          ? r.id.trim()
          : `bpe-${crypto.randomUUID().slice(0, 10)}`,
      brandId,
      eventDate,
      eventType: pick(r.eventType, EVENT_TYPES, "registration"),
      channel: pick(r.channel, CHANNELS, "all"),
      countryCode: r.countryCode ? String(r.countryCode).trim().slice(0, 2) : undefined,
      eventCount: Math.max(0, Math.floor(Number(r.eventCount) || 0)),
      amount: Math.max(0, Number(r.amount) || 0),
      currency: pick(r.currency, CURRENCIES, "USD"),
      importBatchId: r.importBatchId ? String(r.importBatchId) : undefined,
      source: pick(r.source, SOURCES, "manual"),
      createdAt: r.createdAt ?? now,
      updatedAt: now,
    });
  }

  if (normalized.length === 0) {
    return NextResponse.json({ error: "Geçerli olay satırı yok" }, { status: 400 });
  }

  try {
    const { count } = await upsertBrandPlayerEventsBatch(normalized);
    await writeBrandIgamingAudit(session, brandId, "player_events_batch_upsert", {
      entityType: "brand_player_events",
      detail: `count=${count}`,
    });
    await writeAudit(session, "brand_player_events_batch", `brand=${brandId} count=${count}`);
    return NextResponse.json({ ok: true, count });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Oyuncu olayları kaydedilemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
