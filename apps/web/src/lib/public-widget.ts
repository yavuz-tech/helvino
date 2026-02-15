"use client";

type WidgetIdentity = { siteId?: string; orgKey?: string };

const STORAGE_SITE_ID_KEY = "helvino_widget_site_id";
const STORAGE_ORG_KEY_KEY = "helvino_widget_org_key";

function readIdentityFromSearch(): WidgetIdentity {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const siteId = params.get("siteId") || params.get("widgetSiteId") || undefined;
  const orgKey = params.get("orgKey") || params.get("widgetOrgKey") || undefined;
  return { siteId: siteId || undefined, orgKey: orgKey || undefined };
}

function readIdentityFromStorage(): WidgetIdentity {
  if (typeof window === "undefined") return {};
  const siteId = localStorage.getItem(STORAGE_SITE_ID_KEY) || undefined;
  const orgKey = localStorage.getItem(STORAGE_ORG_KEY_KEY) || undefined;
  return { siteId, orgKey };
}

function readIdentityFromEnv(): WidgetIdentity {
  const siteId = process.env.NEXT_PUBLIC_DEFAULT_WIDGET_SITE_ID || undefined;
  const orgKey =
    process.env.NEXT_PUBLIC_DEFAULT_WIDGET_ORG_KEY ||
    process.env.NEXT_PUBLIC_DEFAULT_ORG_KEY ||
    process.env.NEXT_PUBLIC_ORG_KEY ||
    undefined;
  return {
    siteId,
    orgKey,
  };
}

export function resolvePublicWidgetIdentity(): WidgetIdentity {
  const fromSearch = readIdentityFromSearch();
  if (fromSearch.siteId || fromSearch.orgKey) return fromSearch;

  const fromStorage = readIdentityFromStorage();
  if (fromStorage.siteId || fromStorage.orgKey) return fromStorage;

  const fromEnv = readIdentityFromEnv();
  if (fromEnv.siteId || fromEnv.orgKey) return fromEnv;
  return { orgKey: "demo" };
}

export function rememberPublicWidgetIdentity(identity: WidgetIdentity): void {
  if (typeof window === "undefined") return;
  if (identity.siteId) localStorage.setItem(STORAGE_SITE_ID_KEY, identity.siteId);
  if (identity.orgKey) localStorage.setItem(STORAGE_ORG_KEY_KEY, identity.orgKey);
}

export function mountPublicWidgetScript(identity: WidgetIdentity): boolean {
  if (typeof window === "undefined") return false;
  if (!identity.siteId && !identity.orgKey) return false;

  const w = window as unknown as { HELVINO_SITE_ID?: string; HELVINO_ORG_KEY?: string };
  if (identity.siteId) {
    w.HELVINO_SITE_ID = identity.siteId;
    w.HELVINO_ORG_KEY = undefined;
  } else if (identity.orgKey) {
    w.HELVINO_ORG_KEY = identity.orgKey;
    w.HELVINO_SITE_ID = undefined;
  }

  if (document.querySelector('script[data-helvino-widget="1"]')) return true;
  const script = document.createElement("script");
  // embed.js is served from the API origin, not the frontend.
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.helvion.io";
  script.src = `${apiUrl}/embed.js`;
  script.async = true;
  script.setAttribute("data-helvino-widget", "1");
  document.body.appendChild(script);
  return true;
}
