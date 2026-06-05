import { NextRequest, NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { ensureBrandAccess, resolveBrandId } from "@/lib/org-access";
import {
  fetchBrandOnboardingProgress,
  upsertBrandOnboardingProgress,
} from "@/lib/db/brand-igaming-repo";
import { ONBOARDING_STEPS } from "@/types/brand-igaming";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({
      progress: null,
      steps: ONBOARDING_STEPS.map((s) => ({ ...s, done: false })),
    });
  }
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const brandId = resolveBrandId(session, req.nextUrl.searchParams.get("brandId")?.trim());
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });
  const guard = ensureBrandAccess(session, brandId, "read");
  if (guard) return guard;
  const progress = await fetchBrandOnboardingProgress(brandId);
  const steps = ONBOARDING_STEPS.map((s) => ({
    ...s,
    done: Boolean(progress?.steps?.[s.key]),
  }));
  return NextResponse.json({ progress, steps });
}

export async function POST(req: NextRequest) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as {
    brandId?: string;
    stepKey?: string;
    done?: boolean;
    steps?: Record<string, boolean | string>;
  } | null;
  const brandId = resolveBrandId(session, String(body?.brandId ?? "").trim());
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });
  const guard = ensureBrandAccess(session, brandId, "write");
  if (guard) return guard;

  const existing = (await fetchBrandOnboardingProgress(brandId)) ?? {
    brandId,
    steps: {},
  };
  const steps = { ...existing.steps, ...(body?.steps ?? {}) };
  if (body?.stepKey) steps[body.stepKey] = body.done ?? true;

  const allDone = ONBOARDING_STEPS.every((s) => steps[s.key]);
  const saved = await upsertBrandOnboardingProgress({
    brandId,
    steps,
    completedAt: allDone ? new Date().toISOString() : undefined,
  });
  return NextResponse.json({ progress: saved });
}
