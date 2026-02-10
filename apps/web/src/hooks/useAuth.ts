"use client";

import { useEffect } from "react";
import { portalRefreshAccessToken } from "@/lib/portal-auth";

interface UseAuthOptions {
  enabled: boolean;
  onRefreshFailed: () => void;
}

export function useAuth({ enabled, onRefreshFailed }: UseAuthOptions) {
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(async () => {
      const refreshed = await portalRefreshAccessToken();
      if (!refreshed.ok) {
        onRefreshFailed();
      }
    }, 14 * 60 * 1000);
    return () => clearInterval(timer);
  }, [enabled, onRefreshFailed]);
}
