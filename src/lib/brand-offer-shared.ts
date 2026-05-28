import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { notificationToRow } from "@/lib/db/mappers";
import type {
  AppNotification,
  BrandOffer,
  BrandOfferDeliverable,
} from "@/store/store";

export const ALLOWED_OFFER_TYPES: BrandOffer["offerType"][] = [
  "campaign",
  "single_post",
  "long_term",
  "affiliate",
];
export const ALLOWED_OFFER_STATUS: BrandOffer["status"][] = [
  "pending",
  "negotiating",
  "accepted",
  "rejected",
  "withdrawn",
  "expired",
];
export const ALLOWED_OFFER_INITIATOR: BrandOffer["initiator"][] = ["brand", "streamer"];

export function pickEnum<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number]
): T[number] {
  const s = String(value ?? "");
  return (allowed as readonly string[]).includes(s) ? (s as T[number]) : fallback;
}

export function newOfferId(): string {
  return `bo-${crypto.randomUUID().slice(0, 10)}`;
}

export function newOfferMessageId(): string {
  return `bom-${crypto.randomUUID().slice(0, 10)}`;
}

export function newDealId(): string {
  return `bd-${crypto.randomUUID().slice(0, 10)}`;
}

export function newNotifId(): string {
  return `n-${crypto.randomUUID().slice(0, 12)}`;
}

export function parseDeliverables(v: unknown): BrandOfferDeliverable[] {
  if (!Array.isArray(v)) return [];
  const out: BrandOfferDeliverable[] = [];
  for (const raw of v as unknown[]) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const type = String(r.type ?? "").trim();
    const count = Math.max(0, Math.floor(Number(r.count) || 0));
    if (!type) continue;
    out.push({
      type,
      count,
      platform: r.platform ? String(r.platform) : undefined,
      notes: r.notes ? String(r.notes) : undefined,
    });
  }
  return out;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeIsoDate(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.slice(0, 10);
  return ISO_DATE_RE.test(s) ? s : undefined;
}

/**
 * `app_notifications` insert eden best-effort yardımcı. Enum hatası alırsa
 * `type='general'` ile retry yapar; başka hata olursa swallow eder.
 */
export async function insertNotificationSafe(notif: AppNotification): Promise<void> {
  try {
    const { error } = await getSupabaseAdmin()
      .from("app_notifications")
      .insert(notificationToRow(notif));
    if (!error) return;
    const isEnum =
      error.message.includes("enum") || error.message.includes("invalid input value");
    if (isEnum) {
      await getSupabaseAdmin()
        .from("app_notifications")
        .insert(notificationToRow({ ...notif, type: "general" }));
    }
  } catch {
    /* bildirim opsiyonel */
  }
}
