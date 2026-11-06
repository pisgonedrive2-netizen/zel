"use client";

import { useEffect, useSyncExternalStore } from "react";
import { parseMediaRef, youtubeThumbUrl } from "@/lib/media-ref";

export interface ClientThumb {
  thumbnailUrl?: string;
  title?: string;
  videoId?: string;
  /** Sunucu denedi ama kapak bulamadı. */
  missing?: boolean;
}

const STORAGE_KEY = "fox.linkThumbs.v2";
const STORAGE_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const BATCH_SIZE = 8;
const MAX_PARALLEL = 3;

const thumbs = new Map<string, ClientThumb>();
const listeners = new Set<() => void>();
const pending = new Set<string>();
const inflight = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;
let running = 0;
let version = 0;
let hydrated = false;
let clipKey: string | null = null;

/** Açık video yolla sayfasında oturum yok; kapaklar kişinin anahtarıyla istenir. */
export function setThumbClipKey(key: string | null) {
  clipKey = key;
}

function emit() {
  version++;
  for (const l of listeners) l();
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, ClientThumb & { at: number }>;
    const now = Date.now();
    for (const [url, v] of Object.entries(parsed)) {
      if (v?.thumbnailUrl && now - v.at < STORAGE_TTL_MS) thumbs.set(url, v);
    }
  } catch {
    /* bozuk önbellek yok sayılır */
  }
}

function persist() {
  try {
    const at = Date.now();
    const out: Record<string, ClientThumb & { at: number }> = {};
    for (const [url, v] of thumbs) if (v.thumbnailUrl) out[url] = { ...v, at };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
  } catch {
    /* kota dolarsa yalnızca bellekte kalır */
  }
}

function schedule(delay: number) {
  if (!timer) timer = setTimeout(flush, delay);
}

async function flush() {
  timer = null;
  if (running >= MAX_PARALLEL) return;
  const batch = [...pending].slice(0, BATCH_SIZE);
  for (const u of batch) {
    pending.delete(u);
    inflight.add(u);
  }
  if (batch.length === 0) return;
  running++;
  if (pending.size > 0) schedule(30);
  try {
    const res = await fetch("/api/admin/link-thumbs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: batch, clipKey }),
    });
    const json = (await res.json().catch(() => null)) as { thumbs?: Record<string, ClientThumb> } | null;
    for (const u of batch) {
      const t = json?.thumbs?.[u];
      thumbs.set(u, t?.thumbnailUrl ? t : { ...t, missing: true });
    }
    persist();
  } catch {
    for (const u of batch) thumbs.set(u, { missing: true });
  } finally {
    for (const u of batch) inflight.delete(u);
    running--;
    emit();
    if (pending.size > 0) schedule(30);
  }
}

export function requestThumb(url: string) {
  if (!url || thumbs.has(url) || pending.has(url) || inflight.has(url)) return;
  const ref = parseMediaRef(url);
  if (!ref) return;
  if (ref.platform === "youtube") {
    thumbs.set(url, { thumbnailUrl: youtubeThumbUrl(ref.id) });
    emit();
    return;
  }
  pending.add(url);
  schedule(120);
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Görünür olduğunda kapak ister; YouTube anında, IG/TikTok toplu sunucu çağrısıyla. */
export function useLinkThumb(url: string | undefined, enabled = true): ClientThumb | undefined {
  hydrate();
  useSyncExternalStore(subscribe, () => version, () => 0);
  useEffect(() => {
    if (enabled && url) requestThumb(url);
  }, [url, enabled]);
  if (!url) return undefined;
  const hit = thumbs.get(url);
  if (hit) return hit;
  const ref = parseMediaRef(url);
  return ref?.platform === "youtube" ? { thumbnailUrl: youtubeThumbUrl(ref.id) } : undefined;
}
