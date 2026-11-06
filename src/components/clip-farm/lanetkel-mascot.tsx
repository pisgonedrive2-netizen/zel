"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const LANETKEL_VARIANTS: { id: string; label: string; src: string }[] = [
  { id: "hero", label: "Kel", src: "/video-yolla/kel/hero.webp" },
  { id: "tatil", label: "Tatil Kel", src: "/video-yolla/kel/tatil.webp" },
  { id: "aga", label: "Köylü Ağa", src: "/video-yolla/kel/aga.webp" },
  { id: "zengin", label: "Zengin Kel", src: "/video-yolla/kel/zengin.webp" },
  { id: "sporcu", label: "Sporcu Kel", src: "/video-yolla/kel/sporcu.webp" },
  { id: "fakir", label: "Fakir Kel", src: "/video-yolla/kel/fakir.webp" },
  { id: "super", label: "Süper Kel", src: "/video-yolla/kel/super.webp" },
  { id: "thanos", label: "Thanos Kel", src: "/video-yolla/kel/thanos.webp" },
  { id: "korsan", label: "Korsan Kel", src: "/video-yolla/kel/korsan.webp" },
  { id: "astro", label: "Astronot Kel", src: "/video-yolla/kel/astro.webp" },
  { id: "profesor", label: "Profesör Kel", src: "/video-yolla/kel/profesor.webp" },
  { id: "harry", label: "Büyücü Kel", src: "/video-yolla/kel/harry.webp" },
  { id: "joker", label: "Joker Kel", src: "/video-yolla/kel/joker.webp" },
  { id: "prens", label: "Prens Kel", src: "/video-yolla/kel/prens.webp" },
  { id: "tesisatci", label: "Tesisatçı Kel", src: "/video-yolla/kel/tesisatci.webp" },
  { id: "padisah", label: "Padişah Kel", src: "/video-yolla/kel/padisah.webp" },
  { id: "kahya", label: "Kahya Kel", src: "/video-yolla/kel/kahya.webp" },
  { id: "peder", label: "Peder Kel", src: "/video-yolla/kel/peder.webp" },
  { id: "emlakci", label: "Emlakçı Kel", src: "/video-yolla/kel/emlakci.webp" },
  { id: "hades", label: "Hades Kel", src: "/video-yolla/kel/hades.webp" },
  { id: "hirsiz", label: "Hırsız Kel", src: "/video-yolla/kel/hirsiz.webp" },
  { id: "dinhocasi", label: "Hoca Kel", src: "/video-yolla/kel/dinhocasi.webp" },
  { id: "uzayli", label: "Uzaylı Kel", src: "/video-yolla/kel/uzayli.webp" },
  { id: "rastali", label: "Rastalı Kel", src: "/video-yolla/kel/rastali.webp" },
];

const COUNT = LANETKEL_VARIANTS.length;
const AUTO_MS = 2600;
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Oyun tarzı karakter seçimi (Sims / dövüş oyunu menüsü gibi).
 * Otomatik değişmez: kullanıcı küçük kartlardan veya oklardan seçer.
 */
export function LanetkelSelect({ className }: { className?: string }) {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const stripRef = useRef<HTMLDivElement>(null);
  const holdUntil = useRef(0);
  const hovering = useRef(false);
  const current = LANETKEL_VARIANTS[index];

  const go = useCallback((next: number, manual = true) => {
    if (manual) holdUntil.current = Date.now() + 8000;
    setIndex((prev) => {
      const n = ((next % COUNT) + COUNT) % COUNT;
      setDir(n === prev ? 1 : next > prev || (prev === COUNT - 1 && n === 0) ? 1 : -1);
      return n;
    });
  }, []);

  // Karakterler sırayla kendiliğinden geçer; elle seçince kısa süre durur.
  useEffect(() => {
    const t = window.setInterval(() => {
      if (hovering.current || Date.now() < holdUntil.current) return;
      setDir(1);
      setIndex((prev) => (prev + 1) % COUNT);
    }, AUTO_MS);
    return () => window.clearInterval(t);
  }, []);

  // Seçili küçük kartı şeritte görünür tut.
  useEffect(() => {
    const el = stripRef.current?.querySelector<HTMLElement>(`[data-kel="${current.id}"]`);
    const strip = stripRef.current;
    if (!el || !strip) return;
    strip.scrollTo({ left: el.offsetLeft - strip.clientWidth / 2 + el.clientWidth / 2, behavior: "smooth" });
  }, [current.id]);

  // Fare ile 3D eğim.
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotY = useSpring(useTransform(mx, [-0.5, 0.5], [-9, 9]), { stiffness: 140, damping: 18 });
  const rotX = useSpring(useTransform(my, [-0.5, 0.5], [8, -8]), { stiffness: 140, damping: 18 });

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  }
  function onLeave() {
    mx.set(0);
    my.set(0);
  }

  return (
    <div
      className={cn("mx-auto w-full max-w-[300px] select-none sm:max-w-[380px] lg:max-w-[420px]", className)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(index + 1);
        if (e.key === "ArrowLeft") go(index - 1);
      }}
      aria-label="Karakter seç"
      onPointerEnter={() => (hovering.current = true)}
      onPointerLeave={() => (hovering.current = false)}
    >
      <div className="relative px-1" style={{ perspective: 1100 }} onPointerMove={onMove} onPointerLeave={onLeave}>
        {/* Arkada eğik turuncu levha */}
        <div
          className="absolute inset-x-1 inset-y-0 translate-x-2 translate-y-2 rotate-[2deg] rounded-lg border-2 border-[#111] bg-[#ff4d00] sm:translate-x-3 sm:translate-y-3 sm:rotate-[2.5deg]"
          aria-hidden
        />

        <motion.div
          style={{ rotateX: rotX, rotateY: rotY, transformStyle: "preserve-3d" }}
          className="relative overflow-hidden rounded-lg border-2 border-[#111] bg-[#111] shadow-[5px_5px_0_#111] sm:shadow-[6px_6px_0_#111]"
        >
          <div className="relative aspect-[4/5] max-h-[340px] w-full overflow-hidden sm:max-h-none">
            <AnimatePresence initial={false} custom={dir} mode="popLayout">
              <motion.img
                key={current.id}
                custom={dir}
                src={current.src}
                alt={current.label}
                draggable={false}
                className="absolute inset-0 h-full w-full object-cover object-top"
                variants={{
                  enter: (d: number) => ({ opacity: 0, x: d * 60, scale: 1.08 }),
                  center: { opacity: 1, x: 0, scale: 1 },
                  exit: (d: number) => ({ opacity: 0, x: d * -60, scale: 0.96 }),
                }}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              />
            </AnimatePresence>
          </div>

          {/* İsim plakası */}
          <div className="relative flex items-center justify-between border-t-2 border-[#111] bg-[#111] px-4 py-3">
            <motion.span
              key={`bar-${current.id}`}
              className="absolute inset-x-0 top-0 h-[3px] origin-left bg-[#ff4d00]"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: AUTO_MS / 1000, ease: "linear" }}
            />
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={current.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="text-xl uppercase leading-none text-white [font-family:var(--font-vy-display),Impact,sans-serif] sm:text-2xl"
              >
                {current.label}
              </motion.p>
            </AnimatePresence>
            <span className="font-mono text-xs tabular-nums text-[#ff7a3d]">
              {pad(index + 1)}
              <span className="text-white/40"> / {pad(COUNT)}</span>
            </span>
          </div>
        </motion.div>

        <button
          type="button"
          onClick={() => go(index - 1)}
          aria-label="Önceki karakter"
          className="absolute left-0 top-[42%] z-10 flex h-9 w-9 items-center justify-center rounded-md border-2 border-[#111] bg-[#fbf8f1] text-[#111] shadow-[3px_3px_0_#111] transition hover:bg-[#ff4d00] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none sm:-left-4 sm:h-11 sm:w-11"
        >
          <ChevronLeft size={18} strokeWidth={2.5} />
        </button>
        <button
          type="button"
          onClick={() => go(index + 1)}
          aria-label="Sonraki karakter"
          className="absolute right-0 top-[42%] z-10 flex h-9 w-9 items-center justify-center rounded-md border-2 border-[#111] bg-[#fbf8f1] text-[#111] shadow-[3px_3px_0_#111] transition hover:bg-[#ff4d00] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none sm:-right-4 sm:h-11 sm:w-11"
        >
          <ChevronRight size={18} strokeWidth={2.5} />
        </button>
      </div>

      {/* Karakter listesi */}
      <div
        ref={stripRef}
        className="mt-5 flex gap-1.5 overflow-x-auto scroll-smooth rounded-lg border-2 border-[#111] bg-[#fbf8f1] p-1.5 [scrollbar-width:none] sm:mt-6 sm:gap-2 sm:p-2 [&::-webkit-scrollbar]:hidden"
      >
        {LANETKEL_VARIANTS.map((v, i) => {
          const active = i === index;
          return (
            <button
              key={v.id}
              data-kel={v.id}
              type="button"
              onClick={() => go(i)}
              aria-label={v.label}
              aria-pressed={active}
              className={cn(
                "relative h-12 w-12 shrink-0 overflow-hidden rounded-md border-2 transition duration-150 sm:h-14 sm:w-14",
                active ? "-translate-y-0.5 border-[#ff4d00] outline outline-2 outline-[#111]" : "border-[#111]/25 opacity-70 hover:opacity-100"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={v.src} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover object-top" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
