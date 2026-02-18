import { portalApiFetch } from "@/lib/portal-auth";
import type { FeatureKey, PlanKey } from "@helvino/shared";

export type OrgFeaturesPayload = {
  planKey: PlanKey | string;
  features: Record<FeatureKey, boolean>;
  minPlan: Record<FeatureKey, PlanKey>;
};

let _cache: { at: number; promise: Promise<OrgFeaturesPayload> } | null = null;
const CACHE_MS = 30_000;

export async function fetchOrgFeatures(options?: { noCache?: boolean }): Promise<OrgFeaturesPayload> {
  const now = Date.now();
  if (!options?.noCache && _cache && now - _cache.at < CACHE_MS) return _cache.promise;

  const promise = portalApiFetch("/portal/org/features").then(async (r) => {
    const data = await r.json().catch(() => null);
    if (!r.ok || !data?.features) throw new Error("FEATURES_LOAD_FAILED");
    return data as OrgFeaturesPayload;
  });

  _cache = { at: now, promise };
  return promise;
}

