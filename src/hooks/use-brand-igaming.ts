"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/streamer-pool-api";
import { previousMonthYm } from "@/lib/brand-igaming-metrics";
import {
  fetchComplianceChecks,
  fetchIgamingDashboard,
  fetchKpiTargets,
  fetchRiskFlags,
} from "@/lib/marka-igaming-api";
import type {
  BrandComplianceCheck,
  BrandIgamingDashboard,
  BrandKpiTarget,
  BrandRiskFlag,
} from "@/types/brand-igaming";

export function useBrandIgaming(brandId: string | undefined, month: string) {
  const [dashboard, setDashboard] = useState<BrandIgamingDashboard | null>(null);
  const [prevDashboard, setPrevDashboard] = useState<BrandIgamingDashboard | null>(null);
  const [targets, setTargets] = useState<BrandKpiTarget | null>(null);
  const [compliance, setCompliance] = useState<BrandComplianceCheck[]>([]);
  const [riskFlags, setRiskFlags] = useState<BrandRiskFlag[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!brandId) {
      setDashboard(null);
      setPrevDashboard(null);
      setTargets(null);
      setCompliance([]);
      setRiskFlags([]);
      return;
    }

    let cancelled = false;
    const prevMonth = previousMonthYm(month);

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [current, previous, target, checks, flags] = await Promise.all([
          fetchIgamingDashboard(brandId, month),
          fetchIgamingDashboard(brandId, prevMonth).catch(() => null),
          fetchKpiTargets(brandId, month).catch(() => null),
          fetchComplianceChecks(brandId).catch(() => []),
          fetchRiskFlags(brandId).catch(() => []),
        ]);
        if (cancelled) return;
        setDashboard(current);
        setPrevDashboard(previous);
        setTargets(target);
        setCompliance(checks);
        setRiskFlags(flags);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "iGaming verileri yüklenemedi.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [brandId, month]);

  return { dashboard, prevDashboard, targets, compliance, riskFlags, loading, error };
}
