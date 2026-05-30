"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronDown, Radio, Building2, ShieldCheck, HelpCircle, type LucideIcon } from "lucide-react";
import { useAuth, landingFor } from "@/store/auth";
import { useStore, initialBrands } from "@/store/store";
import { BrandMarquee } from "@/components/brand-marquee";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { REGISTRATION_ENABLED } from "@/lib/feature-flags";

// ── Landing yardımcı bileşenler ─────────────────────────────────────────────

function RoleCard({
  color,
  title,
  tag,
  description,
  ctaLabel,
  onCtaClick,
}: {
  color: string;
  title: string;
  tag: string;
  description: string;
  ctaLabel: string;
  onCtaClick: () => void;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/20 hover:bg-white/[0.06]">
      <div
        aria-hidden
        className="absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-20 blur-2xl transition group-hover:opacity-40"
        style={{ background: color }}
      />
      <div className="flex items-center justify-between">
        <span
          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{ background: `${color}22`, color }}
        >
          {tag}
        </span>
        <span className="h-1.5 w-10 rounded-full" style={{ background: color }} />
      </div>
      <h3 className="mt-3 text-xl font-bold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/60">{description}</p>
      <button
        type="button"
        onClick={onCtaClick}
        className="mt-4 inline-flex h-9 items-center justify-center rounded-lg border border-white/15 bg-white/5 px-3.5 text-xs font-semibold text-white transition hover:bg-white/10 active:scale-[0.98]"
      >
        {ctaLabel} →
      </button>
    </div>
  );
}

function StepCard({
  step,
  color,
  title,
  description,
}: {
  step: string;
  color: string;
  title: string;
  description: string;
}) {
  return (
    <li className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-full text-base font-bold text-white"
          style={{ background: color }}
        >
          {step}
        </span>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-white/60">{description}</p>
    </li>
  );
}

function FeatureCard({
  color,
  title,
  description,
}: {
  color: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/20 hover:bg-white/[0.06]">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        <h3 className="text-base font-semibold text-white">{title}</h3>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-white/60">{description}</p>
    </div>
  );
}
import {
  type BrandRegistrationCreateBody,
} from "@/types/brand-registration";

const ORANGE = "#FF6B00";

const dialogCls =
  "max-w-[min(100%-1.5rem,420px)] gap-0 border border-orange-500/30 bg-[#0a0a0a] p-5 text-white ring-orange-500/20 sm:max-w-[420px] [&_[data-slot=dialog-close]]:text-white/70 [&_[data-slot=dialog-close]]:hover:text-white [&_[data-slot=dialog-close]]:hover:bg-white/10";

// Kayıt modalı daha geniş — 2 sütunlu yerleşim ve nefes alan form için.
const registerDialogCls =
  "max-w-[min(100%-1.5rem,560px)] gap-0 border border-orange-500/30 bg-[#0a0a0a] p-5 text-white ring-orange-500/20 sm:max-w-[560px] [&_[data-slot=dialog-close]]:text-white/70 [&_[data-slot=dialog-close]]:hover:text-white [&_[data-slot=dialog-close]]:hover:bg-white/10";

const inputCls =
  "h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-orange-400/60 focus:bg-white/10 focus:ring-2 focus:ring-orange-400/30";

const labelCls = "mb-1 block text-[11px] font-medium uppercase tracking-wide text-white/60";

const btnPrimary =
  "mt-1 h-10 w-full rounded-lg font-semibold text-white shadow-lg shadow-orange-900/30 ring-1 ring-orange-700/30 transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:brightness-90";

const btnGhost = "text-center text-xs font-medium text-white/60 transition hover:text-white";

async function postSupportRequest(body: Record<string, string | undefined>) {
  const res = await fetch("/api/auth/support-request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string };
  if (!res.ok) throw new Error(data.error ?? "İstek gönderilemedi");
  return data.message ?? "Talebiniz alındı.";
}

/** B2B marka başvurusu — backend agent: POST /api/brand-registrations */
async function postBrandRegistration(body: BrandRegistrationCreateBody) {
  const res = await fetch("/api/brand-registrations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string };
  if (!res.ok) throw new Error(data.error ?? "Başvurunuz gönderilemedi");
  return (
    data.message ??
    "Kayıt talebiniz alındı. Onay sonrası giriş bilgileri size iletilecektir."
  );
}

/** Yayıncı self-serve başvurusu (Faz 2): POST /api/streamer-registrations */
async function postStreamerRegistration(body: Record<string, string | undefined>) {
  const res = await fetch("/api/streamer-registrations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string };
  if (!res.ok) throw new Error(data.error ?? "Başvurunuz gönderilemedi");
  return (
    data.message ??
    "Kayıt talebiniz alındı. Onay sonrası giriş bilgileri size iletilecektir."
  );
}

// ── Giriş formu ─────────────────────────────────────────────────────────────

function LoginForm({
  idPrefix,
  autoFocus,
  u,
  setU,
  p,
  setP,
  err,
  busy,
  onSubmit,
  onForgot,
  onRegister,
}: {
  idPrefix: string;
  autoFocus?: boolean;
  u: string;
  setU: (v: string) => void;
  p: string;
  setP: (v: string) => void;
  err: string | null;
  busy: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onForgot: () => void;
  onRegister?: () => void;
}) {
  return (
    <form onSubmit={onSubmit} autoComplete="on" className="flex flex-col gap-3">
      <div className="space-y-1">
        <h2 className="text-xl font-bold leading-tight text-white">Hesabınıza Giriş Yapın</h2>
        <p className="text-xs leading-snug text-white/60">
          Foxstream hesabınızla yayınlarınızı ve ödemelerinizi yönetin.
        </p>
      </div>

      <label className="block">
        <span className={labelCls}>Kullanıcı adı</span>
        <input
          id={`${idPrefix}-user`}
          name="username"
          type="text"
          value={u}
          onChange={(e) => setU(e.target.value)}
          placeholder="ornek: orkun"
          autoComplete="username"
          autoFocus={autoFocus}
          required
          disabled={busy}
          className={inputCls}
        />
      </label>

      <label className="block">
        <span className={labelCls}>Şifre (PIN)</span>
        <input
          id={`${idPrefix}-pass`}
          name="password"
          type="password"
          value={p}
          onChange={(e) => setP(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
          required
          disabled={busy}
          className={inputCls}
        />
      </label>

      {err && (
        <div role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-xs text-red-200">
          {err}
        </div>
      )}

      <button type="submit" disabled={busy || !u || !p} style={{ backgroundColor: ORANGE }} className={btnPrimary}>
        {busy ? "Giriş yapılıyor..." : "→ Giriş Yap"}
      </button>

      <div className="flex flex-col gap-2 pt-1">
        <button type="button" onClick={onForgot} className={btnGhost}>
          Şifremi unuttum
        </button>
        {REGISTRATION_ENABLED && onRegister && (
          <button type="button" onClick={onRegister} className={btnGhost}>
            Hesabım yok — kayıt talebi gönder
          </button>
        )}
      </div>
    </form>
  );
}

// ── Şifremi unuttum ─────────────────────────────────────────────────────────

function ForgotPasswordForm({
  onBack,
  onSuccess,
}: {
  onBack: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [username, setUsername] = useState("");
  const [contact, setContact] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const msg = await postSupportRequest({
        type: "password_reset",
        username,
        contact: contact || undefined,
        note: note || undefined,
      });
      onSuccess(msg);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Talep gönderilemedi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-white">Şifremi Unuttum</h2>
        <p className="text-xs leading-relaxed text-white/60">
          Kullanıcı adınızı ve iletişim bilginizi girin. Talebiniz yöneticiye bildirim olarak iletilir;
          PIN sıfırlandıktan sonra size dönüş yapılır.
        </p>
      </div>

      <label className="block">
        <span className={labelCls}>Kullanıcı adı *</span>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Foxstream kullanıcı adınız"
          required
          disabled={busy}
          className={inputCls}
          autoFocus
        />
      </label>

      <label className="block">
        <span className={labelCls}>İletişim (e-posta / Telegram / telefon)</span>
        <input
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="Size ulaşabileceğimiz bilgi"
          disabled={busy}
          className={inputCls}
        />
      </label>

      <label className="block">
        <span className={labelCls}>Ek not (isteğe bağlı)</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          disabled={busy}
          placeholder="Örn. son giriş tarihi, hesap türü"
          className={`${inputCls} min-h-[72px] resize-none py-2`}
        />
      </label>

      {err && (
        <div role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-xs text-red-200">
          {err}
        </div>
      )}

      <button type="submit" disabled={busy || !username.trim()} style={{ backgroundColor: ORANGE }} className={btnPrimary}>
        {busy ? "Gönderiliyor..." : "Sıfırlama talebi gönder"}
      </button>

      <button type="button" onClick={onBack} className={btnGhost}>
        ← Giriş ekranına dön
      </button>
    </form>
  );
}

// ── Kayıt talebi ────────────────────────────────────────────────────────────

type AccountType = "streamer" | "brand" | "auditor" | "other";

const ACCOUNT_TYPES: {
  value: AccountType;
  label: string;
  desc: string;
  icon: LucideIcon;
}[] = [
  { value: "streamer", label: "Yayıncı", desc: "Havuza katıl, teklif al", icon: Radio },
  { value: "brand", label: "Marka", desc: "B2B panel & affiliate", icon: Building2 },
  { value: "auditor", label: "Denetçi", desc: "Rapor & denetim", icon: ShieldCheck },
  { value: "other", label: "Diğer", desc: "Destek / iş birliği", icon: HelpCircle },
];

/** Yayıncı kaydında seçilebilir platformlar. */
const STREAMER_PLATFORMS = [
  "Instagram",
  "TikTok",
  "YouTube",
  "Kick",
  "Twitch",
  "Twitter / X",
  "Telegram",
] as const;

/** İnce, etiketli bölüm ayracı (turuncu kutu yerine). */
function FieldGroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 flex items-center gap-2.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-orange-300/90">
        {children}
      </span>
      <span className="h-px flex-1 bg-gradient-to-r from-orange-500/30 to-transparent" />
    </div>
  );
}

/** Görsel hesap türü seçici. */
function AccountTypePicker({
  value,
  onChange,
  disabled,
}: {
  value: AccountType;
  onChange: (v: AccountType) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {ACCOUNT_TYPES.map((t) => {
        const active = value === t.value;
        const Icon = t.icon;
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            disabled={disabled}
            aria-pressed={active}
            className={`group flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition disabled:cursor-not-allowed ${
              active
                ? "border-orange-400/60 bg-orange-500/10 ring-1 ring-orange-400/30"
                : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
            }`}
          >
            <span
              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition ${
                active ? "bg-orange-500/20 text-orange-300" : "bg-white/5 text-white/50 group-hover:text-white/70"
              }`}
            >
              <Icon size={15} strokeWidth={2.2} />
            </span>
            <span className="min-w-0">
              <span className={`block text-sm font-semibold ${active ? "text-white" : "text-white/80"}`}>
                {t.label}
              </span>
              <span className="block truncate text-[10px] leading-tight text-white/45">{t.desc}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function RegisterForm({
  onBack,
  onSuccess,
}: {
  onBack: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [preferredUsername, setPreferredUsername] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("streamer");
  const [contact, setContact] = useState("");
  const [note, setNote] = useState("");

  // Marka başvurusu için ek alanlar (kısa ad/kategori/website/hacim → profil sayfasında)
  const [brandName, setBrandName] = useState("");
  const [brandEmail, setBrandEmail] = useState("");
  const [brandPhone, setBrandPhone] = useState("");
  const [brandTelegram, setBrandTelegram] = useState("");

  // Yayıncı başvurusu için ek alanlar (Faz 2)
  const [streamerDisplayName, setStreamerDisplayName] = useState("");
  const [streamerEmail, setStreamerEmail] = useState("");
  const [streamerPlatformSel, setStreamerPlatformSel] = useState<string[]>([]);
  const [streamerMainAccount, setStreamerMainAccount] = useState("");

  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Hızlı kayıt: opsiyonel alanlar varsayılan gizli; sadece zorunlular görünür.
  const [showOptional, setShowOptional] = useState(false);

  const isBrand = accountType === "brand";
  const isStreamer = accountType === "streamer";

  const canSubmit = isBrand
    ? Boolean(brandName.trim() && fullName.trim() && brandEmail.trim())
    : isStreamer
      ? Boolean(streamerDisplayName.trim() && streamerEmail.trim())
      : Boolean(fullName.trim() && contact.trim());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (isBrand) {
        const msg = await postBrandRegistration({
          brandName: brandName.trim(),
          category: "Diğer",
          contactName: fullName.trim(),
          contactEmail: brandEmail.trim(),
          contactPhone: brandPhone.trim() || undefined,
          telegram: brandTelegram.trim() || undefined,
          preferredUsername: preferredUsername.trim() || undefined,
          notes: note.trim() || undefined,
        });
        onSuccess(msg);
      } else if (isStreamer) {
        const platformsLabel = [
          streamerPlatformSel.join(", "),
          streamerMainAccount.trim() ? `Ana hesap: ${streamerMainAccount.trim()}` : "",
        ]
          .filter(Boolean)
          .join(" · ");
        const msg = await postStreamerRegistration({
          displayName: streamerDisplayName.trim(),
          realName: fullName.trim() || undefined,
          contactEmail: streamerEmail.trim(),
          contactPhone: contact.trim() || undefined,
          telegram: brandTelegram.trim() || undefined,
          platforms: platformsLabel || undefined,
          preferredUsername: preferredUsername.trim() || undefined,
          notes: note.trim() || undefined,
        });
        onSuccess(msg);
      } else {
        const msg = await postSupportRequest({
          type: "registration",
          fullName,
          preferredUsername: preferredUsername || undefined,
          accountType,
          contact: contact || undefined,
          note: note || undefined,
        });
        onSuccess(msg);
      }
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Talep gönderilemedi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex max-h-[80vh] flex-col gap-3 overflow-y-auto pr-1">
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-white">Hesap oluştur</h2>
        <p className="text-xs leading-relaxed text-white/60">
          {isBrand
            ? "Markanızı açmak için birkaç bilgi yeterli. Onaydan sonra giriş bilgileriniz iletilir."
            : isStreamer
              ? "Havuza katılmak için başvurun. Onaydan sonra giriş bilgileriniz iletilir."
              : "Hesaplar yönetici onayıyla açılır. Onay sonrası giriş bilgileriniz size iletilir."}
        </p>
      </div>

      <div>
        <span className={labelCls}>Hesap türü</span>
        <AccountTypePicker value={accountType} onChange={setAccountType} disabled={busy} />
      </div>

      <label className="block">
        <span className={labelCls}>
          {isBrand ? "Yetkili ad soyad *" : isStreamer ? "Gerçek ad soyad" : "Ad soyad *"}
        </span>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required={!isStreamer}
          disabled={busy}
          className={inputCls}
          autoFocus
          placeholder={isBrand ? "Ör. Ahmet Yıldız" : isStreamer ? "Ör. Ahmet Yıldız (gizli)" : undefined}
        />
      </label>

      {isBrand ? (
        <>
          <FieldGroupLabel>Marka bilgileri</FieldGroupLabel>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={labelCls}>Marka adı *</span>
              <input
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                required
                disabled={busy}
                className={inputCls}
                placeholder="Ör. Galabet"
              />
            </label>
            <label className="block">
              <span className={labelCls}>İletişim e-postası *</span>
              <input
                type="email"
                value={brandEmail}
                onChange={(e) => setBrandEmail(e.target.value)}
                required
                disabled={busy}
                className={inputCls}
                placeholder="iletisim@markaniz.com"
                autoComplete="email"
                inputMode="email"
              />
            </label>
          </div>

          <p className="text-[11px] leading-relaxed text-white/40">
            Kısa ad, kategori, website ve diğer detayları onay sonrası marka profili
            sayfasından düzenleyebilirsiniz.
          </p>
        </>
      ) : isStreamer ? (
        <>
          <FieldGroupLabel>Yayıncı bilgileri</FieldGroupLabel>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={labelCls}>Sahne / yayıncı adı *</span>
              <input
                value={streamerDisplayName}
                onChange={(e) => setStreamerDisplayName(e.target.value)}
                required
                disabled={busy}
                className={inputCls}
                placeholder="Markaların göreceği ad"
              />
            </label>
            <label className="block">
              <span className={labelCls}>İletişim e-postası *</span>
              <input
                type="email"
                value={streamerEmail}
                onChange={(e) => setStreamerEmail(e.target.value)}
                required
                disabled={busy}
                className={inputCls}
                placeholder="sana@ulasalim.com"
                autoComplete="email"
                inputMode="email"
              />
            </label>
          </div>

          <div className="block">
            <span className={labelCls}>Hangi platformlarda aktifsin?</span>
            <div className="flex flex-wrap gap-1.5">
              {STREAMER_PLATFORMS.map((p) => {
                const active = streamerPlatformSel.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    disabled={busy}
                    aria-pressed={active}
                    onClick={() =>
                      setStreamerPlatformSel((prev) =>
                        prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
                      )
                    }
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed ${
                      active
                        ? "border-orange-400/60 bg-orange-500/15 text-white ring-1 ring-orange-400/30"
                        : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/20 hover:text-white/80"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block">
            <span className={labelCls}>Ana hesabın</span>
            <input
              value={streamerMainAccount}
              onChange={(e) => setStreamerMainAccount(e.target.value)}
              disabled={busy}
              className={inputCls}
              placeholder="@kullaniciadi veya profil linki"
            />
            <span className="mt-1 block text-[10px] leading-relaxed text-white/40">
              Sadece bir ana hesap yeter. Diğer hesapların, kategori ve kitle bilgini
              onaydan sonra profil sayfandan ekleyebilirsin.
            </span>
          </label>
        </>
      ) : (
        <label className="block">
          <span className={labelCls}>İletişim *</span>
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="E-posta, Telegram veya telefon"
            required
            disabled={busy}
            className={inputCls}
          />
        </label>
      )}

      {/* Opsiyonel bilgiler — hızlı kayıt için varsayılan gizli */}
      <div className="rounded-lg border border-white/10 bg-white/[0.02]">
        <button
          type="button"
          onClick={() => setShowOptional((v) => !v)}
          disabled={busy}
          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium text-white/60 transition hover:text-white/80"
        >
          <span>Opsiyonel bilgiler{isBrand || isStreamer ? " (kullanıcı adı, telefon, not)" : " (kullanıcı adı, not)"}</span>
          <ChevronDown size={14} className={`shrink-0 transition ${showOptional ? "rotate-180" : ""}`} />
        </button>
        {showOptional && (
          <div className="space-y-3 border-t border-white/10 px-3 py-3">
            <label className="block">
              <span className={labelCls}>Tercih edilen kullanıcı adı</span>
              <input
                value={preferredUsername}
                onChange={(e) => setPreferredUsername(e.target.value)}
                placeholder={isBrand ? "ornek: galabet" : "ornek: ahmet_yayin"}
                disabled={busy}
                className={inputCls}
              />
            </label>
            {(isBrand || isStreamer) && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className={labelCls}>Telefon</span>
                  <input
                    type="tel"
                    value={isBrand ? brandPhone : contact}
                    onChange={(e) => (isBrand ? setBrandPhone(e.target.value) : setContact(e.target.value))}
                    disabled={busy}
                    className={inputCls}
                    placeholder="+90 …"
                    autoComplete="tel"
                    inputMode="tel"
                  />
                </label>
                <label className="block">
                  <span className={labelCls}>Telegram</span>
                  <input
                    value={brandTelegram}
                    onChange={(e) => setBrandTelegram(e.target.value)}
                    disabled={busy}
                    className={inputCls}
                    placeholder="@kullanici"
                  />
                </label>
              </div>
            )}
            <label className="block">
              <span className={labelCls}>{isBrand ? "Ek not" : "Kısa mesaj"}</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                disabled={busy}
                placeholder={
                  isBrand
                    ? "Beklentileriniz, operatör platformunuz, hedef pazarlar…"
                    : "Kendinizi veya ihtiyacınızı kısaca anlatın"
                }
                className={`${inputCls} min-h-[72px] resize-none py-2`}
              />
            </label>
          </div>
        )}
      </div>

      {err && (
        <div role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-xs text-red-200">
          {err}
        </div>
      )}

      <button
        type="submit"
        disabled={busy || !canSubmit}
        style={{ backgroundColor: ORANGE }}
        className={btnPrimary}
      >
        {busy ? "Gönderiliyor..." : isBrand ? "Marka başvurusu gönder" : isStreamer ? "Yayıncı başvurusu gönder" : "Kayıt talebi gönder"}
      </button>

      <button type="button" onClick={onBack} className={btnGhost}>
        ← Giriş ekranına dön
      </button>
    </form>
  );
}

// ── Sayfa ───────────────────────────────────────────────────────────────────

type AuthModal = "login" | "register" | "forgot" | null;

export default function LoginPage() {
  const { login, user } = useAuth();
  const router = useRouter();
  const storeBrands = useStore((s) => s.brands);

  const marqueeBrands = useMemo(() => {
    const source = storeBrands.length > 0 ? storeBrands : initialBrands;
    const active = source.filter((b) => b.status === "active" || b.status === "paused");
    const list = (active.length > 0 ? active : initialBrands.filter((b) => b.status === "active")).map(
      (b) => ({ id: b.id, name: b.name, shortName: b.shortName })
    );
    return list;
  }, [storeBrands]);

  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<AuthModal>(null);

  useEffect(() => {
    if (user) router.replace(landingFor(user.role));
  }, [user, router]);

  const closeModal = () => {
    setModal(null);
    setErr(null);
    setSuccessMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSuccessMsg(null);
    setBusy(true);
    await new Promise((r) => setTimeout(r, 120));
    const result = await login(u, p);
    if (!result.ok) {
      setErr(result.error);
      setP("");
    } else {
      closeModal();
    }
    setBusy(false);
  };

  const headerBtn =
    "h-9 rounded-lg px-3.5 text-sm font-semibold transition active:scale-[0.98] shadow-lg";

  const openRegister = () => {
    setSuccessMsg(null);
    setErr(null);
    setModal("register");
  };
  const openLogin = () => {
    setSuccessMsg(null);
    setErr(null);
    setModal("login");
  };

  return (
    <div className="relative isolate w-full bg-black text-white">
      {/* Sticky header — scroll boyunca görünür */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/5 bg-black/70 px-4 py-2.5 backdrop-blur-md sm:px-6">
        <a href="#hero" className="flex items-center gap-2">
          <Image src="/foxlogo.png" alt="Foxstream" width={28} height={28} className="rounded-md" priority />
          <span className="text-sm font-bold tracking-wide">Foxstream</span>
        </a>
        <nav className="hidden gap-5 text-xs font-medium text-white/70 md:flex">
          <a href="#roller" className="hover:text-white">Roller</a>
          <a href="#nasil" className="hover:text-white">Nasıl çalışır</a>
          <a href="#ozellikler" className="hover:text-white">Özellikler</a>
          <a href="#partnerler" className="hover:text-white">Partnerler</a>
        </nav>
        <div className="flex items-center gap-2">
          {REGISTRATION_ENABLED && (
            <button
              type="button"
              onClick={openRegister}
              className={`${headerBtn} border border-white/25 bg-black/50 text-white backdrop-blur-sm hover:bg-black/70`}
            >
              Kayıt Ol
            </button>
          )}
          <button
            type="button"
            onClick={openLogin}
            style={{ backgroundColor: ORANGE }}
            className={`${headerBtn} text-white shadow-orange-900/40 ring-1 ring-orange-600/40 hover:brightness-110`}
          >
            Giriş Yap
          </button>
        </div>
      </header>

      {/* HERO — landing.jpg arka planı + okunabilirlik için karartma */}
      <section id="hero" className="relative isolate flex min-h-[calc(100dvh-56px)] w-full flex-col items-center justify-center overflow-hidden px-4 text-center sm:px-6">
        {/* Arka plan görseli — tam ekrana sığar, saydamlık yok (tam opak) */}
        <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
          <Image
            src="/landing.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-contain object-center opacity-100"
          />
        </div>

        <div className="relative z-10 mx-auto max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-orange-300">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: ORANGE }} />
            Yayıncı – Marka platformu
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl">
            Foxstream ile<br />
            <span className="text-orange-400">iş birliğini</span> büyüt.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-white/60 sm:text-base">
            Yayıncı havuzu, teklif &amp; anlaşma akışı, affiliate takibi ve içerik post
            ölçümü — markalar ve yayıncılar için tek panelde.
          </p>
          <div className="mx-auto mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={openLogin}
              style={{ backgroundColor: ORANGE }}
              className="h-11 w-full rounded-lg px-6 text-sm font-semibold text-white shadow-lg shadow-orange-900/40 ring-1 ring-orange-600/40 transition hover:brightness-110 active:scale-[0.98] sm:w-auto"
            >
              Giriş yap
            </button>
            {REGISTRATION_ENABLED && (
              <button
                type="button"
                onClick={openRegister}
                className="h-11 w-full rounded-lg border border-white/20 bg-white/5 px-6 text-sm font-semibold text-white transition hover:bg-white/10 active:scale-[0.98] sm:w-auto"
              >
                Kayıt ol
              </button>
            )}
          </div>
        </div>

        {/* Scroll ipucu */}
        <a
          href="#roller"
          aria-label="Aşağı kaydır"
          className="absolute bottom-[calc(env(safe-area-inset-bottom)+28px)] left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1 text-white/60 transition hover:text-white"
        >
          <span className="text-[10px] font-semibold uppercase tracking-[0.25em]">Keşfet</span>
          <ChevronDown size={18} className="animate-bounce" />
        </a>
      </section>

      {/* ROLLER — login bg'sindeki 4 rol */}
      <section id="roller" className="relative w-full border-y border-white/5 bg-gradient-to-b from-black via-black to-zinc-950 px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-[1180px]">
          <div className="mb-10 text-center">
            <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-orange-400">Foxstream platformu</span>
            <h2 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">
              Yayıncı – Marka iş birliğinin <span className="text-orange-400">tek yeri</span>.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-white/60 sm:text-base">
              Yayıncı havuzu, teklif/anlaşma akışı, affiliate ve içerik post takibi — hepsi bir panelde.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <RoleCard
              color="#FF6B00"
              title="Yayıncılar"
              tag="Streamer"
              description="Yayınlarını yönet ve kitleni büyüt. Profilini havuza koy, markalardan teklif al."
              ctaLabel={REGISTRATION_ENABLED ? "Yayıncı kaydı" : "Giriş yap"}
              onCtaClick={REGISTRATION_ENABLED ? openRegister : openLogin}
            />
            <RoleCard
              color="#22C55E"
              title="Markalar"
              tag="Brand"
              description="Doğru yayıncılarla iş birliği yap. Teklif gönder, anlaşmayı yönet, postları takip et."
              ctaLabel={REGISTRATION_ENABLED ? "Marka kaydı" : "Giriş yap"}
              onCtaClick={REGISTRATION_ENABLED ? openRegister : openLogin}
            />
            <RoleCard
              color="#3B82F6"
              title="Denetim Ekibi"
              tag="Auditor"
              description="Raporları incele, şeffaflığı sağla. Kasa & içerik harcamalarını denetle."
              ctaLabel="Giriş yap"
              onCtaClick={openLogin}
            />
            <RoleCard
              color="#EC4899"
              title="Destek Ekibi"
              tag="Support"
              description="Sorulara hızlı çözümler sun. Marka ve yayıncı taleplerini koordine et."
              ctaLabel="Giriş yap"
              onCtaClick={openLogin}
            />
          </div>
        </div>
      </section>

      {/* NASIL ÇALIŞIR — 4 adım */}
      <section id="nasil" className="relative w-full bg-zinc-950 px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-[1180px]">
          <div className="mb-10 text-center">
            <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-orange-400">Süreç</span>
            <h2 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">Nasıl çalışır?</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-white/60 sm:text-base">
              Kayıttan ilk anlaşmaya kadar 4 adımda Foxstream akışı.
            </p>
          </div>
          <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StepCard
              step="1"
              color="#FF6B00"
              title="Kayıt"
              description="Marka veya yayıncı olarak başvuru gönder. Yönetici onayı ile hesabın açılır."
            />
            <StepCard
              step="2"
              color="#22C55E"
              title="Havuz / Profil"
              description="Yayıncılar havuz profilini doldurur. Markalar filtreli grid'de yayıncıları görür."
            />
            <StepCard
              step="3"
              color="#3B82F6"
              title="Teklif"
              description="Marka teklif gönderir, mesajlaşma + karşı teklif akışı çalışır. Kabul → anlaşma."
            />
            <StepCard
              step="4"
              color="#EC4899"
              title="Anlaşma + Post"
              description="Yayıncı post URL ekler; marka panelinde anında görünür. Affiliate ile ölçümle."
            />
          </ol>
        </div>
      </section>

      {/* ÖZELLİKLER — kart grid */}
      <section id="ozellikler" className="relative w-full border-y border-white/5 bg-gradient-to-b from-zinc-950 via-black to-zinc-950 px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-[1180px]">
          <div className="mb-10 text-center">
            <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-orange-400">Modüller</span>
            <h2 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">Platform özellikleri</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-white/60 sm:text-base">
              Operasyondan ödemeye, partnerden affiliate'e — gerekli her şey hazır.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard color="#FF6B00" title="Yayıncı Havuzu" description="Kategorize edilmiş yayıncı profilleri. Fiyat aralığı, dil, ülke, kitle filtreleri." />
            <FeatureCard color="#22C55E" title="Marka Teklifleri" description="Teklif gönder / karşı teklif / kabul akışı. Sohbet ile şartları netleştir." />
            <FeatureCard color="#3B82F6" title="Anlaşma Yönetimi" description="Bütçe / ödeme / deliverable takibi. Anlaşma ömrü boyunca tek panel." />
            <FeatureCard color="#EC4899" title="Post Takibi" description="Instagram, TikTok, YouTube, Kick post URL'leri. Görüntülenme + beğeni metriği." />
            <FeatureCard color="#FF6B00" title="Affiliate Tracking" description="Partner / günlük metrik / komisyon. CSV import ile manuel veya API ile otomatik." />
            <FeatureCard color="#22C55E" title="Aylık KPI + Rapor" description="Kayıt, FTD, deposit, çekim. PDF ve CSV ile dışa aktarım." />
          </div>
        </div>
      </section>

      {/* CTA — Markaysan / Yayıncıysan */}
      <section className="relative w-full bg-black px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-[1180px] text-center">
          <h2 className="text-3xl font-bold leading-tight sm:text-4xl">
            Hemen başla — <span className="text-orange-400">2 dakikada</span> aktif ol.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-white/60 sm:text-base">
            Mevcut hesabınla giriş yap veya yeni bir marka/yayıncı kaydı oluştur.
          </p>
          <div className="mx-auto mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={openLogin}
              style={{ backgroundColor: ORANGE }}
              className="h-11 rounded-lg px-6 text-sm font-semibold text-white shadow-lg shadow-orange-900/40 ring-1 ring-orange-600/40 transition hover:brightness-110 active:scale-[0.98]"
            >
              Giriş yap
            </button>
            {REGISTRATION_ENABLED && (
              <button
                type="button"
                onClick={openRegister}
                className="h-11 rounded-lg border border-white/20 bg-white/5 px-6 text-sm font-semibold text-white transition hover:bg-white/10 active:scale-[0.98]"
              >
                Marka / Yayıncı kaydı
              </button>
            )}
          </div>
        </div>
      </section>

      {/* PARTNERLER + footer marquee */}
      <section id="partnerler" className="relative w-full shrink-0 border-t border-white/5 bg-gradient-to-t from-black via-black/90 to-transparent pb-[max(env(safe-area-inset-bottom),24px)] pt-10">
        <BrandMarquee brands={marqueeBrands} label="Foxstream partner markaları" dualRow={false} />
        <div className="mx-auto mt-8 flex max-w-[1180px] flex-col items-center justify-between gap-2 px-4 text-[11px] text-white/40 sm:flex-row sm:px-6">
          <span>© {new Date().getFullYear()} Foxstream · Yayıncı – marka iş birliği platformu</span>
          <span>İletişim için yöneticinizle bağlantıya geçin.</span>
        </div>
      </section>

      {/* Giriş popup */}
      <Dialog open={modal === "login"} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent showCloseButton className={dialogCls}>
          {successMsg ? (
            <div className="space-y-4 py-2">
              <p className="text-sm leading-relaxed text-green-200">{successMsg}</p>
              <button type="button" onClick={closeModal} style={{ backgroundColor: ORANGE }} className={btnPrimary}>
                Tamam
              </button>
            </div>
          ) : (
            <LoginForm
              idPrefix="login"
              autoFocus={modal === "login"}
              u={u}
              setU={setU}
              p={p}
              setP={setP}
              err={err}
              busy={busy}
              onSubmit={handleSubmit}
              onForgot={() => {
                setErr(null);
                setModal("forgot");
              }}
              onRegister={
                REGISTRATION_ENABLED
                  ? () => {
                      setErr(null);
                      setModal("register");
                    }
                  : undefined
              }
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Kayıt popup (REGISTRATION_ENABLED=true iken) */}
      {REGISTRATION_ENABLED && (
      <Dialog open={modal === "register"} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent showCloseButton className={registerDialogCls}>
          {successMsg ? (
            <div className="space-y-4 py-2">
              <p className="text-sm leading-relaxed text-green-200">{successMsg}</p>
              <button
                type="button"
                onClick={() => {
                  setSuccessMsg(null);
                  setModal("login");
                }}
                style={{ backgroundColor: ORANGE }}
                className={btnPrimary}
              >
                Giriş ekranına dön
              </button>
            </div>
          ) : (
            <RegisterForm
              onBack={() => {
                setSuccessMsg(null);
                setModal("login");
              }}
              onSuccess={(msg) => setSuccessMsg(msg)}
            />
          )}
        </DialogContent>
      </Dialog>
      )}

      {/* Şifremi unuttum popup */}
      <Dialog open={modal === "forgot"} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent showCloseButton className={dialogCls}>
          {successMsg ? (
            <div className="space-y-4 py-2">
              <p className="text-sm leading-relaxed text-green-200">{successMsg}</p>
              <button
                type="button"
                onClick={() => {
                  setSuccessMsg(null);
                  setModal("login");
                }}
                style={{ backgroundColor: ORANGE }}
                className={btnPrimary}
              >
                Giriş ekranına dön
              </button>
            </div>
          ) : (
            <ForgotPasswordForm
              onBack={() => {
                setSuccessMsg(null);
                setModal("login");
              }}
              onSuccess={(msg) => setSuccessMsg(msg)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
