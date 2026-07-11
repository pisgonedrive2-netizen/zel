"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/store/auth";
import { useStore } from "@/store/store";
import {
  fetchMyPoolProfile,
  isPoolNotReadyError,
} from "@/lib/streamer-pool-api";

const SKIP_KEY_PREFIX = "foxstream-streamer-onboarding-skipped:";

export function streamerOnboardingSkipKey(userId: string): string {
  return `${SKIP_KEY_PREFIX}${userId}`;
}

export function markStreamerOnboardingSkipped(userId: string): void {
  try {
    localStorage.setItem(streamerOnboardingSkipKey(userId), "1");
  } catch {
    /* private mode / SSR */
  }
}

function hasSkipped(userId: string): boolean {
  try {
    return localStorage.getItem(streamerOnboardingSkipKey(userId)) === "1";
  } catch {
    return false;
  }
}

function profileLooksReady(profile: {
  status: string;
  headline: string;
  bio: string;
  categories: string[];
} | null): boolean {
  if (!profile) return false;
  if (profile.status === "published") return true;
  return (
    profile.headline.trim().length > 0 &&
    profile.bio.trim().length > 0 &&
    profile.categories.length > 0
  );
}

/**
 * Havuz profili kurulmamış yeni yayıncıları onboarding'e yönlendirir.
 * Mevcut aktif yayıncılar (hesap/harcama/link kaydı olanlar) yakalanmaz.
 * "Şimdilik geç" localStorage bayrağı ile kalıcı atlanır.
 */
export function StreamerOnboardingGate() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const streamerAccounts = useStore((s) => s.streamerAccounts);
  const brandLinks = useStore((s) => s.brandLinks);
  const contentExpenses = useStore((s) => s.contentExpenses);
  const checkedRef = useRef<string | null>(null);

  useEffect(() => {
    if (user?.role !== "streamer" || !user.id || !user.employeeId) return;
    if (pathname.startsWith("/yayinci/onboarding")) return;
    if (hasSkipped(user.id)) return;
    if (checkedRef.current === user.id) return;

    const empId = user.employeeId;
    const alreadyActive =
      streamerAccounts.some((a) => a.employeeId === empId) ||
      brandLinks.some((l) => l.ownerId === empId) ||
      contentExpenses.some((e) => e.employeeId === empId);
    if (alreadyActive) {
      markStreamerOnboardingSkipped(user.id);
      checkedRef.current = user.id;
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const profile = await fetchMyPoolProfile();
        if (cancelled) return;
        checkedRef.current = user.id;
        if (profileLooksReady(profile)) return;
        router.replace("/yayinci/onboarding");
      } catch (err) {
        if (cancelled) return;
        checkedRef.current = user.id;
        if (isPoolNotReadyError(err)) return;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    user,
    pathname,
    router,
    streamerAccounts,
    brandLinks,
    contentExpenses,
  ]);

  return null;
}
