"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { StreamerSection } from "./streamer-dashboard";

const StreamerDashboard = dynamic(
  () =>
    import("./streamer-dashboard").then((m) => ({
      default: m.StreamerDashboard as ComponentType<{ section: StreamerSection }>,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Panel yükleniyor…
      </div>
    ),
  }
);

export function LazyStreamerDashboard({
  section,
}: {
  section: StreamerSection;
}) {
  return <StreamerDashboard section={section} />;
}
