"use client";

import { useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Send } from "lucide-react";

const TELEGRAM_URL = "https://t.me/lanetkelresmi";
const DISPLAY = "[font-family:var(--font-vy-display),Impact,sans-serif]";

const STRIPES_A =
  "repeating-linear-gradient(115deg,#111 0 20px,#ff4d00 20px 40px)";
const STRIPES_B =
  "repeating-linear-gradient(-115deg,#111 0 20px,#f5efe3 20px 40px)";

/** CSS ile çizilmiş 3D film klaketi. Üst çubuk periyodik olarak "klap" yapar. */
function Clapperboard() {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotY = useSpring(useTransform(mx, [-0.5, 0.5], [-26, -4]), { stiffness: 120, damping: 16 });
  const rotX = useSpring(useTransform(my, [-0.5, 0.5], [14, 0]), { stiffness: 120, damping: 16 });
  const [tick, setTick] = useState(0);

  return (
    <div
      className="mx-auto w-[min(100%,280px)] sm:w-[320px]"
      style={{ perspective: 1000 }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width - 0.5);
        my.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onPointerLeave={() => {
        mx.set(-0.1);
        my.set(0);
      }}
      onClick={() => setTick((t) => t + 1)}
    >
      <motion.div
        style={{ rotateY: rotY, rotateX: rotX, transformStyle: "preserve-3d" }}
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7 }}
        className="relative cursor-pointer"
      >
        {/* Arka kalınlık katmanları */}
        {[18, 12, 6].map((z, i) => (
          <div
            key={z}
            aria-hidden
            className="absolute inset-0 rounded-md bg-black"
            style={{ transform: `translateZ(-${z}px)`, opacity: 0.5 + i * 0.15 }}
          />
        ))}

        {/* Üst çubuk (hareketli) */}
        <motion.div
          key={tick}
          className="relative z-10 h-11 origin-bottom-left overflow-hidden rounded-t-md border-2 border-[#111]"
          style={{ background: STRIPES_A, transformStyle: "preserve-3d" }}
          animate={{ rotate: [-20, -20, 0, -20] }}
          transition={{ duration: 4.2, times: [0, 0.62, 0.68, 1], ease: "easeOut", repeat: Infinity }}
        />
        {/* Sabit çubuk */}
        <div
          className="relative z-0 h-9 border-x-2 border-b-2 border-[#111]"
          style={{ background: STRIPES_B, transform: "translateZ(2px)" }}
        />
        {/* Menteşe */}
        <span className="absolute left-2 top-[38px] z-20 h-3.5 w-3.5 rounded-full border-2 border-[#111] bg-[#d9d2c3]" />

        {/* Gövde */}
        <div
          className="relative rounded-b-md border-2 border-t-0 border-[#111] bg-[#171717] p-3 text-white shadow-[8px_8px_0_#ff4d00]"
          style={{ transform: "translateZ(4px)" }}
        >
          <div className="grid grid-cols-3 border border-white/70 text-center">
            {[
              ["SAHNE", "01"],
              ["ÇEKİM", "01"],
              ["MAKARA", "24"],
            ].map(([k, v], i) => (
              <div key={k} className={`px-1 py-1.5 ${i < 2 ? "border-r border-white/70" : ""}`}>
                <p className="font-mono text-[9px] tracking-widest text-[#ff7a3d]">{k}</p>
                <p className={`text-xl leading-none ${DISPLAY}`}>{v}</p>
              </div>
            ))}
          </div>

          <div className="mt-2 border border-white/70 px-3 py-2.5">
            <p className="font-mono text-[9px] tracking-widest text-[#ff7a3d]">SENARYO</p>
            <p className={`mt-1 text-[1.55rem] leading-none tracking-wide sm:text-3xl ${DISPLAY}`}>lanetkelresmi</p>
          </div>

          <div className="mt-2 grid grid-cols-[1.4fr_1fr] border border-white/70">
            <div className="border-r border-white/70 px-3 py-2">
              <p className="font-mono text-[9px] tracking-widest text-[#ff7a3d]">KONU</p>
              <p className="mt-0.5 text-[11px] font-bold uppercase leading-tight">Sponsorluk ve reklam anlaşması</p>
            </div>
            <div className="px-3 py-2">
              <p className="font-mono text-[9px] tracking-widest text-[#ff7a3d]">YAPIM</p>
              <p className="mt-0.5 text-[11px] font-bold uppercase leading-tight">Lanetkel</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/** Film seti arka planlı iletişim bölümü: sponsorluk ve reklam anlaşması. */
export function ReklamSection() {
  return (
    <section
      id="reklam"
      className="relative overflow-hidden bg-[#111] text-white"
      style={{
        backgroundImage:
          "repeating-linear-gradient(90deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 180px)",
      }}
    >
      {/* Film şeridi delikleri */}
      {(["top-2", "bottom-2"] as const).map((pos) => (
        <div
          key={pos}
          aria-hidden
          className={`absolute inset-x-0 ${pos} h-3`}
          style={{
            backgroundImage: "repeating-linear-gradient(90deg,#efe9dd 0 16px,transparent 16px 34px)",
            WebkitMaskImage: "linear-gradient(#000,#000)",
            opacity: 0.9,
            borderRadius: 2,
          }}
        />
      ))}

      <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-4 py-12 sm:gap-10 sm:px-5 sm:py-14 md:grid-cols-[0.9fr_1.1fr] md:gap-12">
        <Clapperboard />

        <div className="text-center md:text-left">
          <p className="font-mono text-[10px] tracking-[0.25em] text-[#ff7a3d] sm:text-xs">SPONSORLUK · REKLAM</p>
          <h2 className={`mt-2 text-3xl uppercase leading-[1.05] sm:mt-3 sm:text-4xl ${DISPLAY}`}>
            Sponsorluk ve reklam anlaşması için
          </h2>
          <p className="mt-3 text-base font-medium text-white/70 sm:mt-4 sm:text-lg">
            Yazman yeterli: <span className="font-bold text-white">@lanetkelresmi</span>
          </p>
          <a
            href={TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-md border-2 border-white bg-[#ff4d00] px-5 text-sm font-bold text-[#111] shadow-[4px_4px_0_#fff] transition hover:-translate-y-0.5 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none sm:mt-6 sm:h-12 sm:px-6"
          >
            <Send size={16} strokeWidth={2.5} /> Telegram&apos;dan yaz
          </a>
        </div>
      </div>
    </section>
  );
}
