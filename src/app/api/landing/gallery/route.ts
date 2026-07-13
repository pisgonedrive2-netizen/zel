import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getLandingGalleryItems, galleryViewsLabel } from "@/lib/landing-gallery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public — landing “kesitler” galerisi. */
export async function GET() {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ ok: true, items: [] });
  }
  const items = await getLandingGalleryItems();
  return NextResponse.json({
    ok: true,
    items: items.map((it) => ({
      ...it,
      viewsLabel: galleryViewsLabel(it.views),
    })),
  });
}
