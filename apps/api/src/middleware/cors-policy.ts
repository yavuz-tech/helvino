export interface CorsPolicy {
  isProduction: boolean;
  corsHasWildcard: boolean;
  corsAllowedOrigins: Set<string>;
  hasCorsAllowlist: boolean;
}

export function buildCorsPolicy(
  nodeEnv: string | undefined,
  rawOrigins: Array<string | undefined>
): CorsPolicy {
  const isProduction = nodeEnv === "production";
  const corsRawOrigins = rawOrigins
    .filter(Boolean)
    .flatMap((value) => String(value).split(",").map((entry) => entry.trim()))
    .filter(Boolean);
  const corsHasWildcard = corsRawOrigins.some((origin) => origin === "*" || origin.includes("*"));
  const corsAllowedOrigins = new Set(
    corsRawOrigins.filter((origin) => origin !== "*" && !origin.includes("*"))
  );
  return {
    isProduction,
    corsHasWildcard,
    corsAllowedOrigins,
    hasCorsAllowlist: corsAllowedOrigins.size > 0,
  };
}

function isLocalhostOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "::1"
    );
  } catch {
    return false;
  }
}

export function isOriginAllowedByCorsPolicy(
  origin: string | undefined,
  policy: CorsPolicy
): boolean {
  if (!policy.isProduction) {
    if (policy.hasCorsAllowlist) {
      if (!origin) return true;
      try {
        const url = new URL(origin);
        return policy.corsAllowedOrigins.has(url.origin) || isLocalhostOrigin(origin);
      } catch {
        return false;
      }
    }
    if (!origin) return true;
    return isLocalhostOrigin(origin);
  }

  if (!policy.hasCorsAllowlist) return false;
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return policy.corsAllowedOrigins.has(url.origin);
  } catch {
    return false;
  }
}
