"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

const STEPS = [
  { img: "/video-yolla/steps/klip-kes.webp", title: "Klip kes", text: "Yayından ya da reels'ten kesit al" },
  { img: "/video-yolla/steps/link-gonder.webp", title: "Linki gönder", text: "Paylaştığın videonun linkini yolla" },
  { img: "/video-yolla/steps/odul-al.webp", title: "Ödül al", text: "Onaylanan klipler ödenir" },
] as const;

function StepCard({ step, i }: { step: (typeof STEPS)[number]; i: number }) {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotY = useSpring(useTransform(mx, [-0.5, 0.5], [-12, 12]), { stiffness: 150, damping: 16 });
  const rotX = useSpring(useTransform(my, [-0.5, 0.5], [10, -10]), { stiffness: 150, damping: 16 });

  return (
    <motion.div
      initial={{ opacity: 0, y: 36, rotateX: -12 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, delay: i * 0.14, ease: [0.22, 1, 0.36, 1] }}
      style={{ perspective: 1000 }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width - 0.5);
        my.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onPointerLeave={() => {
        mx.set(0);
        my.set(0);
      }}
    >
      <motion.div
        style={{ rotateX: rotX, rotateY: rotY, transformStyle: "preserve-3d" }}
        className="relative overflow-hidden rounded-lg border-2 border-[#111] bg-[#111] p-4 pt-4 shadow-[5px_5px_0_#ff4d00] sm:p-5 sm:shadow-[6px_6px_0_#ff4d00]"
      >
        <span className="absolute left-4 top-3 text-4xl leading-none text-transparent [-webkit-text-stroke:1.5px_#ff4d00] [font-family:var(--font-vy-display),Impact,sans-serif] sm:left-5 sm:top-4 sm:text-5xl">
          {i + 1}
        </span>

        <motion.div
          className="relative mx-auto h-28 w-28 sm:h-36 sm:w-36 lg:h-40 lg:w-40"
          style={{ transform: "translateZ(60px)" }}
          animate={{ y: [0, -9, 0], rotate: [0, i % 2 ? -2.5 : 2.5, 0] }}
          transition={{ duration: 4.5 + i * 0.6, repeat: Infinity, ease: "easeInOut", delay: i * 0.4 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={step.img}
            alt=""
            draggable={false}
            className="h-full w-full object-contain drop-shadow-[0_16px_24px_rgba(0,0,0,0.6)]"
          />
        </motion.div>

        <div className="relative mt-2 text-center sm:mt-3" style={{ transform: "translateZ(30px)" }}>
          <h3 className="text-xl uppercase leading-none text-white [font-family:var(--font-vy-display),Impact,sans-serif] sm:text-2xl">
            {step.title}
          </h3>
          <p className="mt-1.5 text-xs text-white/60 sm:mt-2 sm:text-sm">{step.text}</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function StepCards() {
  return (
    <div className="grid gap-3 sm:grid-cols-3 sm:gap-5">
      {STEPS.map((s, i) => (
        <StepCard key={s.title} step={s} i={i} />
      ))}
    </div>
  );
}
