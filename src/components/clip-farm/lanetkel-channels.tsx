"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  listPublicLanetkelChannels,
  PUBLIC_CHANNEL_PLATFORM_ORDER,
  type PublicLanetkelChannel,
  type PublicChannelPlatform,
} from "@/lib/lanetkel-channels";
import { Platform3dIcon } from "@/components/clip-farm/platform-3d-icon";

function ChannelCard({
  platform,
  items,
  i,
}: {
  platform: PublicChannelPlatform;
  items: PublicLanetkelChannel[];
  i: number;
}) {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotY = useSpring(useTransform(mx, [-0.5, 0.5], [-8, 8]), { stiffness: 150, damping: 16 });
  const rotX = useSpring(useTransform(my, [-0.5, 0.5], [7, -7]), { stiffness: 150, damping: 16 });

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay: (i % 3) * 0.1, ease: [0.22, 1, 0.36, 1] }}
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
        className="relative h-full overflow-hidden rounded-lg border-2 border-[#111] bg-[#111] p-4 shadow-[5px_5px_0_#ff4d00] sm:p-5 sm:shadow-[6px_6px_0_#ff4d00]"
      >
        <div className="mb-3 flex items-center gap-3 sm:mb-4 sm:gap-4" style={{ transform: "translateZ(40px)" }}>
          <motion.div
            animate={{ y: [0, -6, 0], rotate: [0, i % 2 ? -3 : 3, 0] }}
            transition={{ duration: 4 + (i % 4) * 0.5, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 }}
          >
            <Platform3dIcon platform={platform} size={60} className="drop-shadow-[0_10px_14px_rgba(0,0,0,0.7)]" />
          </motion.div>
          <div>
            <p className="text-xl uppercase leading-none text-white [font-family:var(--font-vy-display),Impact,sans-serif] sm:text-2xl">
              {platform}
            </p>
            <p className="mt-1 text-xs font-semibold text-[#ff7a3d] sm:mt-1.5">{items.length} kanal</p>
          </div>
        </div>
        <ul className="flex flex-wrap gap-1.5" style={{ transform: "translateZ(20px)" }}>
          {items.map((c) => (
            <li key={c.url}>
              <a
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded-md border border-white/20 bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-white/85 transition hover:border-[#ff4d00] hover:bg-[#ff4d00] hover:text-[#111]"
              >
                {c.handle}
              </a>
            </li>
          ))}
        </ul>
      </motion.div>
    </motion.div>
  );
}

export function LanetkelChannels() {
  const channels = listPublicLanetkelChannels();
  const grouped = PUBLIC_CHANNEL_PLATFORM_ORDER.map((platform) => ({
    platform: platform as PublicChannelPlatform,
    items: channels.filter((c) => c.platform === platform),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:gap-5">
      {grouped.map((g, i) => (
        <ChannelCard key={g.platform} platform={g.platform} items={g.items} i={i} />
      ))}
    </div>
  );
}
