export type DeployEnv = "local" | "staging" | "production";

export function getDeployEnv(): DeployEnv {
  // Prefer explicit env set by deploy platform (Railway, Vercel, etc.)
  const raw =
    (process.env.NEXT_PUBLIC_DEPLOY_ENV || process.env.RAILWAY_ENVIRONMENT_NAME || "")
      .trim()
      .toLowerCase();

  if (raw === "production" || raw === "prod") return "production";
  if (raw === "staging" || raw === "stage" || raw === "preview") return "staging";

  // Local dev / unknown defaults
  return "local";
}

