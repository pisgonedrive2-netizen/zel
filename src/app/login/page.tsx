"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth, landingFor } from "@/store/auth";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { REGISTRATION_ENABLED } from "@/lib/feature-flags";

const ORANGE = "#FF6B00";

const dialogCls =
  "max-w-[min(100%-1.5rem,420px)] gap-0 border border-orange-500/30 bg-[#0a0a0a] p-5 text-white ring-orange-500/20 sm:max-w-[420px] [&_[data-slot=dialog-close]]:text-white/70 [&_[data-slot=dialog-close]]:hover:text-white [&_[data-slot=dialog-close]]:hover:bg-white/10";

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

function RegisterForm({
  onBack,
  onSuccess,
}: {
  onBack: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [preferredUsername, setPreferredUsername] = useState("");
  const [accountType, setAccountType] = useState("streamer");
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
        type: "registration",
        fullName,
        preferredUsername: preferredUsername || undefined,
        accountType,
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
        <h2 className="text-xl font-bold text-white">Kayıt Talebi</h2>
        <p className="text-xs leading-relaxed text-white/60">
          Foxstream hesapları yönetici onayıyla açılır. Bilgilerinizi gönderin; onay sonrası giriş bilgileriniz
          size iletilir.
        </p>
      </div>

      <label className="block">
        <span className={labelCls}>Ad soyad *</span>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} required disabled={busy} className={inputCls} autoFocus />
      </label>

      <label className="block">
        <span className={labelCls}>Tercih edilen kullanıcı adı</span>
        <input
          value={preferredUsername}
          onChange={(e) => setPreferredUsername(e.target.value)}
          placeholder="ornek: ahmet_yayin"
          disabled={busy}
          className={inputCls}
        />
      </label>

      <label className="block">
        <span className={labelCls}>Hesap türü</span>
        <select
          value={accountType}
          onChange={(e) => setAccountType(e.target.value)}
          disabled={busy}
          className={inputCls}
        >
          <option value="streamer">Yayıncı</option>
          <option value="brand">Marka</option>
          <option value="auditor">Denetçi</option>
          <option value="other">Diğer</option>
        </select>
      </label>

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

      <label className="block">
        <span className={labelCls}>Kısa mesaj</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          disabled={busy}
          placeholder="Kendinizi veya ihtiyacınızı kısaca anlatın"
          className={`${inputCls} min-h-[72px] resize-none py-2`}
        />
      </label>

      {err && (
        <div role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-xs text-red-200">
          {err}
        </div>
      )}

      <button type="submit" disabled={busy || !fullName.trim() || !contact.trim()} style={{ backgroundColor: ORANGE }} className={btnPrimary}>
        {busy ? "Gönderiliyor..." : "Kayıt talebi gönder"}
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
    const ok = await login(u, p);
    if (!ok) {
      setErr("Kullanıcı adı veya şifre hatalı.");
      setP("");
    } else {
      closeModal();
    }
    setBusy(false);
  };

  const headerBtn =
    "h-9 rounded-lg px-3.5 text-sm font-semibold transition active:scale-[0.98] shadow-lg";

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-black">
      {/* Mobil görsel */}
      <div className="md:hidden absolute inset-0">
        <Image
          src="/moblogin.png"
          alt="Fox Streaming"
          fill
          priority
          sizes="100vw"
          className="object-contain object-center"
        />
      </div>

      {/* Masaüstü görsel */}
      <div className="hidden md:block absolute inset-0">
        <Image
          src="/login-bg-dash4.png"
          alt=""
          fill
          priority
          unoptimized
          sizes="100vw"
          className="scale-110 object-cover object-center blur-2xl brightness-75"
        />
        <Image
          src="/login-bg-dash4.png"
          alt="Fox Streaming"
          fill
          priority
          unoptimized
          sizes="100vw"
          className="object-contain object-center"
        />
      </div>

      {/* Köşe butonları — mobil + web */}
      <header className="absolute top-0 right-0 z-20 flex items-center gap-2 p-3 pt-[max(env(safe-area-inset-top),12px)] pr-[max(env(safe-area-inset-right),12px)]">
        {REGISTRATION_ENABLED && (
          <button
            type="button"
            onClick={() => {
              setSuccessMsg(null);
              setErr(null);
              setModal("register");
            }}
            className={`${headerBtn} border border-white/25 bg-black/50 text-white backdrop-blur-sm hover:bg-black/70`}
          >
            Kayıt Ol
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setSuccessMsg(null);
            setErr(null);
            setModal("login");
          }}
          style={{ backgroundColor: ORANGE }}
          className={`${headerBtn} text-white shadow-orange-900/40 ring-1 ring-orange-600/40 hover:brightness-110`}
        >
          Giriş Yap
        </button>
      </header>

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
