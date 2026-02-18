"use client";

import { useState, useEffect } from "react";
import { fetchOrgFeatures, type OrgFeaturesPayload } from "@/lib/org-features";
import type { FeatureKey, PlanKey } from "@helvino/shared";

interface FeatureAccessState {
  loading: boolean;
  error: string | null;
  planKey: PlanKey | string;
  features: Record<string, boolean>;
  minPlan: Record<string, string>;
  can: (feature: FeatureKey) => boolean;
  refresh: () => void;
}

export function useFeatureAccess(): FeatureAccessState {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OrgFeaturesPayload | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchOrgFeatures({ noCache: tick > 0 })
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load feature entitlements");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [tick]);

  const can = (feature: FeatureKey): boolean => {
    if (!data) return false;
    return Boolean(data.features[feature]);
  };

  return {
    loading,
    error,
    planKey: data?.planKey ?? "free",
    features: data?.features ?? {},
    minPlan: data?.minPlan ?? {},
    can,
    refresh: () => setTick((t) => t + 1),
  };
}
