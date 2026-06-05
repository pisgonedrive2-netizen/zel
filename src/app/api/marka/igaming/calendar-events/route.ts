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
  fetchBrandCalendarEvents,
  upsertBrandCalendarEvent,
} from "@/lib/db/brand-igaming-repo";
import { writeBrandIgamingAudit } from "@/lib/brand-igaming-audit";
import type { BrandCalendarEvent } from "@/types/brand-igaming";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EVENT_TYPES: readonly BrandCalendarEvent["eventType"][] = [
  "campaign", "compliance", "launch", "payout", "content", "other",
];

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

  try {
    const events = await fetchBrandCalendarEvents(brandId, from, to);
    return NextResponse.json({ events });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Takvim olayları alınamadı";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  if (!hasOrgCapability(session, "crm")) {
    return NextResponse.json({ error: "Takvim olayı ekleme yetkisi yok" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Partial<BrandCalendarEvent> | null;
  if (!body) return NextResponse.json({ error: "JSON gövdesi gerekli" }, { status: 400 });

  const requestedBrandId = String(body.brandId ?? "").trim() || null;
  const guard = ensureBrandAccess(session, requestedBrandId, "write");
  if (guard) return guard;
  const brandId = resolveBrandId(session, requestedBrandId) ?? requestedBrandId ?? "";
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });

  const title = String(body.title ?? "").trim();
  const eventDate = String(body.eventDate ?? "").slice(0, 10);
  if (!title) return NextResponse.json({ error: "title gerekli" }, { status: 400 });
  if (!ISO_DATE_RE.test(eventDate)) {
    return NextResponse.json({ error: "eventDate formatı YYYY-MM-DD olmalı" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const isNew = !(typeof body.id === "string" && /^bcal-/i.test(body.id));
  const event: BrandCalendarEvent = {
    id: isNew ? `bcal-${crypto.randomUUID().slice(0, 10)}` : (body.id as string),
    brandId,
    eventDate,
    title,
    eventType: pick(body.eventType, EVENT_TYPES, "other"),
    refId: body.refId ? String(body.refId) : undefined,
    notes: String(body.notes ?? "").trim(),
    createdAt: body.createdAt ?? now,
  };

  try {
    const saved = await upsertBrandCalendarEvent(event);
    await writeBrandIgamingAudit(session, brandId, isNew ? "calendar_event_created" : "calendar_event_updated", {
      entityType: "brand_calendar_events",
      entityId: saved.id,
      detail: saved.title,
    });
    await writeAudit(
      session,
      isNew ? "brand_calendar_event_created" : "brand_calendar_event_updated",
      `event=${saved.id} brand=${brandId}`,
    );
    return NextResponse.json({ event: saved });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Takvim olayı kaydedilemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
