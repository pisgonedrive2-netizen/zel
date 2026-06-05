import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import {
  appendBrandWebhookLog,
  findBrandOperatorById,
  findImportBatchById,
  upsertBrandPlayerEventsBatch,
  upsertImportBatch,
} from "@/lib/db/brand-igaming-repo";
import type { BrandPlayerEvent, PlayerEventType } from "@/types/brand-igaming";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEBHOOK_EVENT_TYPES: readonly PlayerEventType[] = ["registration", "ftd", "deposit"];
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface WebhookEventPayload {
  eventType?: string;
  eventDate?: string;
  eventCount?: number;
  amount?: number;
  currency?: string;
  channel?: string;
  countryCode?: string;
}

interface WebhookBody {
  events?: WebhookEventPayload[];
}

function pickEventType(v: unknown): PlayerEventType | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (WEBHOOK_EVENT_TYPES.includes(s as PlayerEventType)) return s as PlayerEventType;
  return null;
}

function batchIdFromRequest(req: Request): string | null {
  return (
    req.headers.get("import_batch_id")?.trim() ||
    req.headers.get("x-import-batch-id")?.trim() ||
    null
  );
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ operatorId: string }> },
) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }

  const { operatorId } = await ctx.params;
  const opId = operatorId?.trim();
  if (!opId) return NextResponse.json({ error: "operatorId gerekli" }, { status: 400 });

  const importBatchId = batchIdFromRequest(req);
  if (!importBatchId) {
    return NextResponse.json({ error: "import_batch_id başlığı gerekli" }, { status: 400 });
  }

  const operator = await findBrandOperatorById(opId);
  if (!operator) {
    return NextResponse.json({ error: "Operatör bulunamadı" }, { status: 404 });
  }
  if (operator.status !== "active") {
    return NextResponse.json({ error: "Operatör aktif değil" }, { status: 403 });
  }

  const existingBatch = await findImportBatchById(importBatchId);
  if (existingBatch?.status === "done" && existingBatch.brandId === operator.brandId) {
    await appendBrandWebhookLog({
      id: `bwh-${crypto.randomUUID().slice(0, 10)}`,
      brandId: operator.brandId,
      operatorId: opId,
      eventType: "webhook_duplicate",
      statusCode: 200,
      payload: { importBatchId, duplicate: true },
    });
    return NextResponse.json({ ok: true, duplicate: true, count: existingBatch.rowsImported });
  }

  const body = (await req.json().catch(() => null)) as WebhookBody | null;
  if (!body?.events || !Array.isArray(body.events)) {
    return NextResponse.json({ error: "events[] gerekli" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const normalized: BrandPlayerEvent[] = [];

  for (const raw of body.events) {
    const eventType = pickEventType(raw.eventType);
    if (!eventType) continue;
    const eventDate = String(raw.eventDate ?? "").slice(0, 10);
    if (!ISO_DATE_RE.test(eventDate)) continue;
    normalized.push({
      id: `bpe-${crypto.randomUUID().slice(0, 10)}`,
      brandId: operator.brandId,
      eventDate,
      eventType,
      channel:
        raw.channel === "affiliate" || raw.channel === "organic" || raw.channel === "influencer"
          ? raw.channel
          : "all",
      countryCode: raw.countryCode ? String(raw.countryCode).trim().slice(0, 2) : undefined,
      eventCount: Math.max(0, Math.floor(Number(raw.eventCount) || 1)),
      amount: Math.max(0, Number(raw.amount) || 0),
      currency:
        raw.currency === "EUR" || raw.currency === "TRY" ? raw.currency : "USD",
      importBatchId,
      source: "webhook",
      createdAt: now,
      updatedAt: now,
    });
  }

  let statusCode = 200;
  let errorMsg: string | undefined;

  try {
    await upsertImportBatch({
      id: importBatchId,
      brandId: operator.brandId,
      source: `webhook:${opId}`,
      status: "processing",
      rowsTotal: body.events.length,
      rowsImported: 0,
      createdAt: now,
    });

    if (normalized.length > 0) {
      await upsertBrandPlayerEventsBatch(normalized);
    }

    await upsertImportBatch({
      id: importBatchId,
      brandId: operator.brandId,
      source: `webhook:${opId}`,
      status: "done",
      rowsTotal: body.events.length,
      rowsImported: normalized.length,
      createdAt: now,
      finishedAt: new Date().toISOString(),
    });

    await appendBrandWebhookLog({
      id: `bwh-${crypto.randomUUID().slice(0, 10)}`,
      brandId: operator.brandId,
      operatorId: opId,
      eventType: "webhook_events",
      statusCode: 200,
      payload: { importBatchId, count: normalized.length },
    });

    return NextResponse.json({ ok: true, count: normalized.length, importBatchId });
  } catch (e) {
    statusCode = 500;
    errorMsg = e instanceof Error ? e.message : "Webhook işlenemedi";
    try {
      await upsertImportBatch({
        id: importBatchId,
        brandId: operator.brandId,
        source: `webhook:${opId}`,
        status: "failed",
        rowsTotal: body.events.length,
        rowsImported: 0,
        errorMessage: errorMsg,
        createdAt: now,
        finishedAt: new Date().toISOString(),
      });
      await appendBrandWebhookLog({
        id: `bwh-${crypto.randomUUID().slice(0, 10)}`,
        brandId: operator.brandId,
        operatorId: opId,
        eventType: "webhook_events",
        statusCode,
        error: errorMsg,
        payload: { importBatchId },
      });
    } catch {
      /* best effort */
    }
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
