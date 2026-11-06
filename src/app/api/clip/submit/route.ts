import { NextRequest, NextResponse, after } from "next/server";
import { isRapidApiEnabled, isSupabaseEnabled } from "@/lib/env";
import { parseMediaRef } from "@/lib/media-ref";
import { CLIP_LIMITS } from "@/lib/clip-farm/abuse";
import {
  ensureOpenCampaign,
  addSubmissions,
  createCreator,
  creatorByContact,
  creatorByKey,
  countCreatorPending,
  countCreatorSince,
  countIpSince,
  countNewCreatorsByIpSince,
  normalizeAccounts,
  refreshSubmission,
  touchCreatorSubmit,
} from "@/lib/clip-farm/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < CLIP_LIMITS.windowMs);
  list.push(now);
  hits.set(ip, list);
  return list.length > CLIP_LIMITS.maxRequestsPerIpWindow;
}

type Body = {
  key?: string;
  campaignId?: string;
  name?: string;
  contact?: string;
  accounts?: unknown;
  urls?: unknown;
  website?: string;
};

const clean = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "local"
  );
}

/** Açık sayfa: video linki gönderimi. İlk gönderimde kişi kaydı açılır ve gizli anahtar döner. */
export async function POST(req: NextRequest) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ ok: false, error: "Şu an gönderim alınamıyor." }, { status: 503 });
  }
  const ip = clientIp(req);
  if (rateLimited(ip)) {
    return NextResponse.json(
      { ok: false, error: "Çok sık gönderim yaptın. 10 dakika sonra tekrar dene." },
      { status: 429 }
    );
  }
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ ok: false, error: "Geçersiz istek." }, { status: 400 });
  if (body.website) return NextResponse.json({ ok: true, results: [] });

  const urls = (Array.isArray(body.urls) ? body.urls : [])
    .filter((u): u is string => typeof u === "string")
    .map((u) => u.trim())
    .filter(Boolean);
  if (urls.length > CLIP_LIMITS.maxUrlsPerRequest) {
    return NextResponse.json(
      { ok: false, error: `Tek seferde en fazla ${CLIP_LIMITS.maxUrlsPerRequest} link gönderebilirsin.` },
      { status: 400 }
    );
  }

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const ipHour = await countIpSince(ip, hourAgo);
  if (ipHour >= CLIP_LIMITS.maxPerIpPerHour) {
    return NextResponse.json(
      { ok: false, error: "Bu ağdan saatlik gönderim limiti doldu. Biraz sonra dene." },
      { status: 429 }
    );
  }

  const campaigns = await ensureOpenCampaign().catch(() => []);
  const campaign =
    campaigns.find((c) => c.id === body.campaignId) ?? (campaigns.length === 1 ? campaigns[0] : undefined);
  if (!campaign) return NextResponse.json({ ok: false, error: "Kampanya seç." }, { status: 400 });

  let creator = body.key ? await creatorByKey(clean(body.key, 64)) : null;
  if (body.key && !creator) {
    return NextResponse.json(
      { ok: false, error: "Kişisel anahtarın geçersiz. Bilgilerini tekrar gir." },
      { status: 400 }
    );
  }
  if (creator?.status === "blocked") {
    return NextResponse.json({ ok: false, error: "Bu hesaptan gönderim kapalı." }, { status: 403 });
  }

  let isNewCreator = false;
  if (!creator) {
    const name = clean(body.name, 80);
    const contact = clean(body.contact, 120);
    const accounts = normalizeAccounts(body.accounts);
    if (!name) return NextResponse.json({ ok: false, error: "Adını yaz." }, { status: 400 });
    if (!contact) {
      return NextResponse.json(
        { ok: false, error: "Telegram veya telefon yaz; hak edişte sana buradan ulaşacağız." },
        { status: 400 }
      );
    }
    if (accounts.length === 0) {
      return NextResponse.json({ ok: false, error: "En az bir sosyal medya hesabını yaz." }, { status: 400 });
    }

    const existing = await creatorByContact(contact);
    if (existing) {
      if (existing.status === "blocked") {
        return NextResponse.json({ ok: false, error: "Bu hesaptan gönderim kapalı." }, { status: 403 });
      }
      creator = existing;
    } else {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const newByIp = await countNewCreatorsByIpSince(ip, dayAgo);
      if (newByIp >= CLIP_LIMITS.maxNewCreatorsPerIpPerDay) {
        return NextResponse.json(
          { ok: false, error: "Bu ağdan çok fazla yeni kayıt açıldı. Yarın tekrar dene veya mevcut linkini kullan." },
          { status: 429 }
        );
      }
      creator = await createCreator({
        name,
        contact,
        email: "",
        payoutMethod: "",
        payoutDetails: "",
        accounts,
        submitIp: ip,
      });
      isNewCreator = true;
    }
  }

  // Link yoksa sadece kayıt/hesap bilgisi alınır; hesaptan kontrol edilir.
  if (urls.length === 0) {
    return NextResponse.json({ ok: true, key: creator.accessKey, results: [], reusedProfile: !isNewCreator && !body.key });
  }

  const pending = await countCreatorPending(creator.id);
  if (pending >= CLIP_LIMITS.maxPendingPerCreator) {
    return NextResponse.json(
      {
        ok: false,
        error: `Onay bekleyen ${pending} videon var. Moderasyon bitmeden yeni gönderim kapalı.`,
        key: creator.accessKey,
      },
      { status: 429 }
    );
  }

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const todayCount = await countCreatorSince(creator.id, dayAgo);
  const room = CLIP_LIMITS.maxPerCreatorPerDay - todayCount;
  if (room <= 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "Günlük gönderim limitine ulaştın. Yarın devam edebilirsin.",
        key: creator.accessKey,
      },
      { status: 429 }
    );
  }

  const urlsToAdd = urls.slice(0, Math.min(urls.length, room, CLIP_LIMITS.maxPendingPerCreator - pending));
  const results = await addSubmissions({
    creatorId: creator.id,
    campaign,
    urls: urlsToAdd,
    source: "creator",
    submitIp: ip,
  });
  if (urls.length > urlsToAdd.length) {
    for (const u of urls.slice(urlsToAdd.length)) {
      results.push({ url: u, ok: false, error: "Limit nedeniyle bu istekte alınmadı" });
    }
  }

  const added = results.filter((r) => r.ok && r.id);
  await touchCreatorSubmit(creator.id, ip, added.length);

  if (isRapidApiEnabled() && added.length > 0) {
    after(async () => {
      for (const r of added) {
        const platform = parseMediaRef(r.url)?.platform;
        if (platform) await refreshSubmission({ id: r.id!, url: r.url, platform });
      }
    });
  }
  return NextResponse.json({
    ok: true,
    key: creator.accessKey,
    results,
    reusedProfile: !isNewCreator && !body.key,
  });
}
