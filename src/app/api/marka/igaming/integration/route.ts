import { NextRequest, NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { ensureBrandAccess, resolveBrandId, writeAudit } from "@/lib/org-access";
import {
  createBrandApiKey,
  fetchBrandApiKeys,
  fetchBrandImportBatches,
  fetchLatestImportBatch,
  fetchLatestWebhookLog,
  fetchBrandWebhookLogs,
} from "@/lib/db/brand-igaming-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ apiKeys: [], webhookLogs: [], importBatches: [], lastWebhook: null, lastImport: null });
  }
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const brandId = resolveBrandId(session, req.nextUrl.searchParams.get("brandId")?.trim());
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });
  const guard = ensureBrandAccess(session, brandId, "read");
  if (guard) return guard;
  try {
    const [apiKeys, webhookLogs, importBatches, lastWebhook, lastImport] = await Promise.all([
      fetchBrandApiKeys(brandId),
      fetchBrandWebhookLogs(brandId, 20),
      fetchBrandImportBatches(brandId, 10),
      fetchLatestWebhookLog(brandId),
      fetchLatestImportBatch(brandId),
    ]);
    return NextResponse.json({
      apiKeys,
      webhookLogs,
      importBatches,
      lastWebhook: lastWebhook
        ? { eventType: lastWebhook.eventType, statusCode: lastWebhook.statusCode, createdAt: lastWebhook.createdAt }
        : null,
      lastImport: lastImport
        ? {
            id: lastImport.id,
            source: lastImport.source,
            status: lastImport.status,
            rowsImported: lastImport.rowsImported,
            createdAt: lastImport.createdAt,
          }
        : null,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Entegrasyon verisi alınamadı" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { brandId?: string; label?: string; operatorId?: string } | null;
  const brandId = resolveBrandId(session, String(body?.brandId ?? "").trim());
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });
  const guard = ensureBrandAccess(session, brandId, "write");
  if (guard) return guard;
  try {
    const result = await createBrandApiKey({
      brandId,
      label: String(body?.label ?? "default").trim() || "default",
      operatorId: body?.operatorId?.trim() || undefined,
      createdBy: session.userId,
    });
    await writeAudit(session, "brand_api_key_created", `key=${result.apiKey.id} prefix=${result.apiKey.keyPrefix}`);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Anahtar oluşturulamadı" }, { status: 500 });
  }
}
