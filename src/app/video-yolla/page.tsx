"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Plus,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import { parseMediaRef } from "@/lib/media-ref";
import {
  CLIP_PLATFORMS,
  PLATFORM_LABEL,
  type ClipAccount,
  type ClipCampaign,
  type ClipPlatform,
} from "@/lib/clip-farm/types";
import { CLIP_KEY_STORAGE } from "@/components/clip-farm/shared";
import { VideoYollaStage, VY_DISPLAY } from "@/components/clip-farm/video-yolla-stage";
import { LanetkelSelect } from "@/components/clip-farm/lanetkel-mascot";
import { StepCards } from "@/components/clip-farm/step-cards";
import { ReklamSection } from "@/components/clip-farm/reklam-clapper";
import { LanetkelChannels } from "@/components/clip-farm/lanetkel-channels";
import { clipPublicPaths, resolveClipHostHint } from "@/lib/clip-host";
import { setThumbClipKey } from "@/lib/link-thumb-client";
import { cn } from "@/lib/utils";

type CampaignLoadHint = "paused" | "none" | "offline" | "error";

type Result = { url: string; ok: boolean; error?: string };

const fieldCls =
  "h-11 w-full rounded-md border-2 border-[#111] bg-white px-3.5 text-sm text-[#111] outline-none transition placeholder:text-[#111]/40 focus:border-[#ff4d00] focus:shadow-[3px_3px_0_#ff4d00]";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.5, ease: "easeOut" as const },
};

export default function VideoYollaPage() {
  const [campaigns, setCampaigns] = useState<ClipCampaign[] | null>(null);
  const [campaignHint, setCampaignHint] = useState<CampaignLoadHint | null>(null);
  const [campaignId, setCampaignId] = useState("");
  const [key, setKey] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [accounts, setAccounts] = useState<ClipAccount[]>([{ platform: "instagram", handle: "" }]);
  const [links, setLinks] = useState("");
  const [website, setWebsite] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Result[] | null>(null);
  const [paths, setPaths] = useState(() => clipPublicPaths(null));

  useEffect(() => {
    setPaths(clipPublicPaths(resolveClipHostHint()));
    const storedKey = window.localStorage.getItem(CLIP_KEY_STORAGE);
    setKey(storedKey);
    if (storedKey) setThumbClipKey(storedKey);
    void fetch("/api/clip/campaigns")
      .then(async (r) => {
        const j = (await r.json()) as {
          ok?: boolean;
          campaigns?: ClipCampaign[];
          hint?: CampaignLoadHint;
        };
        if (!r.ok || j.ok === false) {
          setCampaigns([]);
          setCampaignHint(j.hint === "offline" ? "offline" : "error");
          return;
        }
        const list = j.campaigns ?? [];
        setCampaigns(list);
        setCampaignHint(list.length === 0 ? (j.hint ?? "none") : null);
        if (list.length > 0) setCampaignId(list[0].id);
      })
      .catch(() => {
        setCampaigns([]);
        setCampaignHint("error");
      });
  }, []);

  const campaign = campaigns?.find((c) => c.id === campaignId);
  const lines = useMemo(
    () =>
      links
        .split(/[\s,]+/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((url) => {
          const ref = parseMediaRef(url);
          const allowed = !!ref && (!campaign || campaign.platforms.includes(ref.platform));
          return { url, ref, allowed };
        }),
    [campaign, links]
  );
  const validCount = lines.filter((l) => l.allowed).length;
  const statusUrl = key ? paths.statusUrl(key) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResults(null);
    setSending(true);
    try {
      const res = await fetch("/api/clip/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          campaignId,
          name,
          contact,
          accounts: accounts.filter((a) => a.handle.trim()),
          urls: lines.filter((l) => l.allowed).map((l) => l.url),
          website,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; key?: string; results?: Result[]; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Gönderilemedi, tekrar dene.");
        if (res.status === 400 && json.error?.includes("anahtar")) {
          window.localStorage.removeItem(CLIP_KEY_STORAGE);
          setKey(null);
        }
        return;
      }
      if (json.key) {
        window.localStorage.setItem(CLIP_KEY_STORAGE, json.key);
        setKey(json.key);
      }
      setResults(json.results ?? []);
      if ((json.results ?? []).every((r) => r.ok)) setLinks("");
    } catch {
      setError("Bağlantı hatası, tekrar dene.");
    } finally {
      setSending(false);
    }
  }

  function forget() {
    window.localStorage.removeItem(CLIP_KEY_STORAGE);
    setKey(null);
    setResults(null);
  }

  return (
    <VideoYollaStage>
      {/* Üst bar */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-5 sm:py-4">
        <a href="#top" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/foxlogo.png" alt="" className="h-9 w-9 rounded-md border-2 border-[#111]" />
          <span className={cn("text-2xl leading-none tracking-wide", VY_DISPLAY)}>
            video<span className="text-[#ff4d00]">yolla</span>
          </span>
        </a>
        <nav className="flex items-center gap-1 text-sm font-semibold">
          <a href="#nasil" className="hidden rounded-md px-3 py-1.5 transition hover:bg-[#111]/10 sm:block">
            Nasıl çalışır
          </a>
          <a href="#kanallar" className="hidden rounded-md px-3 py-1.5 transition hover:bg-[#111]/10 sm:block">
            Kanallar
          </a>
          {statusUrl && (
            <Link href={statusUrl} className="rounded-md px-3 py-1.5 transition hover:bg-[#111]/10">
              Durumum
            </Link>
          )}
          <a
            href="#gonder"
            className="ml-1 rounded-md border-2 border-[#111] bg-[#111] px-3.5 py-1.5 text-white shadow-[3px_3px_0_#ff4d00] transition hover:-translate-y-0.5"
          >
            Klip gönder
          </a>
        </nav>
      </header>

      <main id="top" className="mx-auto w-full max-w-6xl px-4 sm:px-5">
        {/* Hero */}
        <section className="grid items-center gap-8 py-6 sm:gap-10 sm:py-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12 lg:py-10">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className="text-center lg:text-left"
          >
            <h1 className={cn("text-[1.7rem] leading-[1.12] min-[420px]:text-[2.1rem] sm:text-5xl lg:text-[3.5rem]", VY_DISPLAY)}>
              <span className="block">Lanetkel videolarından</span>
              <span className="block">klip çıkar,</span>
              <span className="mt-2 inline-block bg-[#ff4d00] px-2.5 pb-1 pt-1.5 leading-none sm:mt-3 sm:px-3 sm:pt-2">
                reels paylaşarak kazan.
              </span>
            </h1>
            <p className="mx-auto mt-4 max-w-md text-base font-medium text-[#111]/70 sm:mt-5 sm:text-lg lg:mx-0">
              Kestiğin klibi hesabında paylaş, linkini aşağıdan gönder.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3 sm:mt-6 sm:gap-4 lg:justify-start">
              <a
                href="#gonder"
                className="inline-flex h-11 items-center gap-2 rounded-md border-2 border-[#111] bg-[#ff4d00] px-5 text-sm font-bold shadow-[4px_4px_0_#111] transition hover:-translate-y-0.5 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none sm:h-12 sm:px-6"
              >
                Klip gönder <ArrowRight size={16} strokeWidth={2.5} />
              </a>
              <a
                href="#kanallar"
                className="inline-flex h-11 items-center rounded-md border-2 border-[#111] bg-transparent px-5 text-sm font-bold transition hover:bg-[#111] hover:text-white sm:h-12 sm:px-6"
              >
                Kanalları gör
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
          >
            <LanetkelSelect />
          </motion.div>
        </section>
      </main>

      <main className="mx-auto w-full max-w-6xl px-4 sm:px-5">
        {/* Nasıl çalışır */}
        <motion.section {...fadeUp} id="nasil" className="scroll-mt-16 py-8 sm:py-10">
          <StepCards />
        </motion.section>
      </main>

      <ReklamSection />

      <main className="mx-auto w-full max-w-6xl px-4 pb-12 pt-10 sm:px-5 sm:pb-14 sm:pt-12">
        {/* Form */}
        <motion.section {...fadeUp} id="gonder" className="scroll-mt-16">
          <div className="mx-auto max-w-2xl">
            <div className="mb-4 text-center sm:mb-5">
              <h2 className={cn("text-3xl sm:text-4xl", VY_DISPLAY)}>Klip gönder</h2>
            </div>

            {campaigns === null ? (
              <p className="flex items-center justify-center gap-2 py-10 text-sm text-[#111]/60">
                <Loader2 size={16} className="animate-spin" /> Yükleniyor…
              </p>
            ) : campaigns.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#111]/40 bg-[#fbf8f1] px-5 py-10 text-center text-sm text-[#111]/70">
                {campaignHint === "paused" ? (
                  <>
                    <p className="font-semibold text-[#111]">Kampanya geçici olarak kapalı</p>
                    <p className="mt-2 text-[#111]/60">
                      Yönetici panelden kampanya tekrar açıldığında link gönderebilirsin. Durum sayfan açık kalır.
                    </p>
                  </>
                ) : campaignHint === "offline" ? (
                  <>
                    <p className="font-semibold text-[#111]">Sistem bakımda</p>
                    <p className="mt-2 text-[#111]/60">Kısa süre sonra tekrar dene.</p>
                  </>
                ) : campaignHint === "error" ? (
                  <>
                    <p className="font-semibold text-[#111]">Kampanyalar yüklenemedi</p>
                    <p className="mt-2 text-[#111]/60">Sayfayı yenile veya biraz sonra tekrar dene.</p>
                  </>
                ) : (
                  <p>Şu an aktif kampanya yok — yönetici açana kadar gönderim kapalı.</p>
                )}
              </div>
            ) : (
              <form
                onSubmit={submit}
                className="space-y-4 rounded-lg border-2 border-[#111] bg-[#fbf8f1] p-4 shadow-[6px_6px_0_#111] sm:space-y-5 sm:p-6 sm:shadow-[8px_8px_0_#111]"
              >
                {campaigns.length > 1 && (
                  <div className="flex flex-wrap gap-2">
                    {campaigns.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setCampaignId(c.id)}
                        className={cn(
                          "rounded-md border-2 px-3 py-1.5 text-sm font-semibold transition",
                          c.id === campaignId
                            ? "border-[#111] bg-[#ff4d00] text-[#111]"
                            : "border-[#111]/30 text-[#111]/70 hover:border-[#111]"
                        )}
                      >
                        {c.title}
                      </button>
                    ))}
                  </div>
                )}

                {key ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-700/40 bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-900">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 size={16} /> Kayıtlısın
                    </span>
                    <button type="button" onClick={forget} className="text-xs font-semibold text-[#111]/60 hover:text-[#111]">
                      Değiştir
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Ad soyad">
                        <input value={name} onChange={(e) => setName(e.target.value)} className={fieldCls} maxLength={80} />
                      </Field>
                      <Field label="Telegram / telefon">
                        <input
                          value={contact}
                          onChange={(e) => setContact(e.target.value)}
                          className={fieldCls}
                          placeholder="@kullanici veya 05xx"
                        />
                      </Field>
                    </div>
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-[#111]">Hesapların</span>
                      {accounts.map((a, i) => (
                        <div key={i} className="flex gap-2">
                          <select
                            value={a.platform}
                            onChange={(e) =>
                              setAccounts((prev) =>
                                prev.map((x, j) => (j === i ? { ...x, platform: e.target.value as ClipPlatform } : x))
                              )
                            }
                            className={cn(fieldCls, "w-[7.5rem] shrink-0 sm:w-36")}
                          >
                            {CLIP_PLATFORMS.map((p) => (
                              <option key={p} value={p} className="bg-white text-[#111]">
                                {PLATFORM_LABEL[p]}
                              </option>
                            ))}
                          </select>
                          <input
                            value={a.handle}
                            onChange={(e) =>
                              setAccounts((prev) => prev.map((x, j) => (j === i ? { ...x, handle: e.target.value } : x)))
                            }
                            placeholder="@kullaniciadi"
                            className={fieldCls}
                          />
                          {accounts.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setAccounts((prev) => prev.filter((_, j) => j !== i))}
                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border-2 border-[#111]/30 text-[#111]/60 transition hover:border-[#111] hover:text-[#111]"
                              aria-label="Hesabı sil"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      ))}
                      {accounts.length < 6 && (
                        <button
                          type="button"
                          onClick={() => setAccounts((prev) => [...prev, { platform: "tiktok", handle: "" }])}
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#c2410c] hover:text-[#ff4d00]"
                        >
                          <Plus size={13} /> Hesap ekle
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <Field label="Klip linkleri (isteğe bağlı)">
                  <textarea
                    value={links}
                    onChange={(e) => setLinks(e.target.value)}
                    rows={3}
                    placeholder={"https://www.instagram.com/reel/...\nhttps://www.tiktok.com/@.../video/..."}
                    className={cn(fieldCls, "h-auto resize-none py-3 font-mono text-xs leading-relaxed")}
                  />
                </Field>

                {lines.length > 0 && (
                  <ul className="space-y-1 text-xs">
                    {lines.map((l, i) => (
                      <li key={`${l.url}-${i}`} className="flex items-center gap-1.5 text-[#111]/75">
                        {l.allowed ? (
                          <CheckCircle2 size={13} className="shrink-0 text-emerald-600" />
                        ) : (
                          <XCircle size={13} className="shrink-0 text-rose-600" />
                        )}
                        <span className="truncate">{l.url}</span>
                        {!l.allowed && (
                          <span className="shrink-0 text-rose-600">{l.ref ? "bu platform yok" : "video linki değil"}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                <input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="hidden"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden
                />

                {error && (
                  <p className="rounded-md border-2 border-rose-700/50 bg-rose-100 px-4 py-3 text-sm font-semibold text-rose-900">
                    {error}
                  </p>
                )}

                {results && (
                  <div className="space-y-2 rounded-md border-2 border-[#111] bg-white p-4">
                    <p className="text-sm font-bold text-[#111]">
                      {results.length === 0
                        ? "Kaydın alındı"
                        : `${results.filter((r) => r.ok).length} klip gönderildi`}
                      {results.some((r) => !r.ok) && `, ${results.filter((r) => !r.ok).length} eklenemedi`}
                    </p>
                    <ul className="space-y-1 text-xs text-[#111]/75">
                      {results.map((r) => (
                        <li key={r.url} className="flex items-center gap-1.5">
                          {r.ok ? (
                            <CheckCircle2 size={13} className="text-emerald-600" />
                          ) : (
                            <XCircle size={13} className="text-rose-600" />
                          )}
                          <span className="truncate">{r.url}</span>
                          {r.error && <span className="shrink-0 text-rose-600">{r.error}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={sending}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md border-2 border-[#111] bg-[#ff4d00] text-sm font-bold text-[#111] shadow-[4px_4px_0_#111] transition hover:-translate-y-0.5 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-60"
                >
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  {validCount > 0 ? `${validCount} klibi gönder` : key ? "Gönder" : "Kaydı gönder"}
                </button>
              </form>
            )}
          </div>
        </motion.section>

        {/* Kanallar */}
        <motion.section {...fadeUp} id="kanallar" className="scroll-mt-16 pt-10 sm:pt-12">
          <div className="mb-4 text-center sm:mb-5">
            <h2 className={cn("text-3xl sm:text-4xl", VY_DISPLAY)}>Lanetkel kanalları</h2>
          </div>
          <LanetkelChannels />
        </motion.section>
      </main>

      <footer className="border-t-2 border-[#111] py-4 text-center text-xs font-semibold text-[#111]/55 sm:py-5">
        videoyolla.com · lanetkel
      </footer>
    </VideoYollaStage>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-bold text-[#111]">{label}</span>
      {children}
    </label>
  );
}
