"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth, landingFor } from "@/store/auth";
import { GlowCard } from "@/components/glow-card";

const ORANGE = "#FF6B00";

type FormFieldsProps = {
  idPrefix: string;
  autoFocusUser?: boolean;
  u: string;
  setU: (v: string) => void;
  p: string;
  setP: (v: string) => void;
  err: string | null;
  info: string | null;
  busy: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onForgot: () => void;
};

function FormFields({ idPrefix, autoFocusUser, u, setU, p, setP, err, info, busy, onSubmit, onForgot }: FormFieldsProps) {
  return (
    <form onSubmit={onSubmit} autoComplete="on" className="flex flex-col gap-3">
      <div className="space-y-1">
        <h1 className="text-xl font-bold leading-tight text-white sm:text-2xl">Hesabınıza Giriş Yapın</h1>
        <p className="text-xs leading-snug text-white/60 sm:text-sm">
          Yayınlarınızı yönetmek için Foxstream hesabınıza erişin.
        </p>
      </div>

      <label className="block">
        <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-white/60">
          Kullanıcı adı
        </span>
        <input
          id={`${idPrefix}-user`}
          name="username"
          type="text"
          value={u}
          onChange={(e) => setU(e.target.value)}
          placeholder="ornek: orkun"
          autoComplete="username"
          autoFocus={autoFocusUser}
          required
          disabled={busy}
          className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-orange-400/60 focus:bg-white/10 focus:ring-2 focus:ring-orange-400/30"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-white/60">Şifre</span>
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
          className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-orange-400/60 focus:bg-white/10 focus:ring-2 focus:ring-orange-400/30"
        />
      </label>

      {err && (
        <div role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-xs leading-snug text-red-200">
          {err}
        </div>
      )}

      {info && !err && (
        <div role="status" className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs leading-snug text-white/80">
          {info}
        </div>
      )}

      <button
        type="submit"
        disabled={busy || !u || !p}
        style={{ backgroundColor: ORANGE }}
        className="mt-1 h-10 rounded-lg font-semibold text-white shadow-lg shadow-orange-900/30 ring-1 ring-orange-700/30 transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:brightness-90"
      >
        {busy ? "Giriş yapılıyor..." : "→ Giriş Yap"}
      </button>

      <button
        type="button"
        onClick={onForgot}
        className="text-center text-xs font-medium text-white/60 transition hover:text-white"
      >
        Şifremi unuttum
      </button>
    </form>
  );
}

export default function LoginPage() {
  const { login, user } = useAuth();
  const router = useRouter();

  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) router.replace(landingFor(user.role));
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setInfo(null);
    setBusy(true);
    await new Promise((r) => setTimeout(r, 120));
    const ok = await login(u, p);
    if (!ok) {
      setErr("Kullanıcı adı veya şifre hatalı.");
      setP("");
    }
    setBusy(false);
  };

  const handleForgot = () => {
    setErr(null);
    setInfo("Şifre sıfırlama için yönetici ile iletişime geçin.");
  };

  const shared = { u, setU, p, setP, err, info, busy, onSubmit: handleSubmit, onForgot: handleForgot };

  // GlowCard için opak siyah backdrop + turuncu kenar overrides.
  const cardStyle = {
    "--backdrop": "rgba(10, 10, 10, 0.92)",
    "--backup-border": "rgba(255, 107, 0, 0.25)",
    "--radius": "16",
    "--border": "1.5",
  } as CSSProperties;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-black">
      {/* Blurred dolgu — tüm ekranı kapatır, kenarlarda boşluk kalmasın */}
      <Image
        src="/login-bg-dash4.png"
        alt=""
        fill
        priority
        unoptimized
        sizes="100vw"
        className="scale-110 object-cover object-center blur-2xl brightness-75"
      />
      {/* Orijinal resim — mobilde tepe, desktop'ta tam ortada görünür */}
      <Image
        src="/login-bg-dash4.png"
        alt=""
        fill
        priority
        unoptimized
        sizes="100vw"
        className="object-contain object-top sm:object-center"
      />

      {/* Mobil için form alanına geçişi yumuşatan gradient */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-black/30 to-black/85 sm:bg-gradient-to-r sm:from-transparent sm:via-black/10 sm:to-black/70" />

      <div className="relative z-10 flex h-full w-full items-end justify-center px-4 pb-[max(env(safe-area-inset-bottom),20px)] pt-[max(env(safe-area-inset-top),16px)] sm:items-center md:items-start md:justify-end md:px-10 md:pt-[6vh] md:pb-10 lg:px-16 lg:pt-[8vh]">
        <GlowCard
          customSize
          asBlock
          glowColor="orange"
          className="w-full max-w-[400px] !p-5 sm:!p-7"
          style={cardStyle}
        >
          <FormFields idPrefix="d" autoFocusUser {...shared} />
        </GlowCard>
      </div>
    </div>
  );
}
