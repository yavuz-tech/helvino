import "./loader.css";
import { resolveWidgetLang, tWidget, type WidgetLang } from "./i18n";

const FRAME_ORIGIN = "https://api.helvion.io";
const Z_TOP = 2147483647;

function resolveWidgetLangOrNull(raw: unknown): WidgetLang | null {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (v === "tr" || v === "en" || v === "es") return v;
  return null;
}

function getCookie(name: string): string | null {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1] || "") : null;
  } catch {
    return null;
  }
}

function getEmbedVersionParam(): string {
  // If the embed script URL includes ?v=..., carry it into CSS + iframe URLs.
  // This is a safe cache-buster for production CDNs.
  try {
    const cs = document.currentScript as HTMLScriptElement | null;
    const src = cs?.src || "";
    if (!src) return "";
    const u = new URL(src);
    return u.searchParams.get("v") || "";
  } catch {
    return "";
  }
}

function getHostLang(): WidgetLang | null {
  // Highest priority: explicit language set by embedder.
  const w = window as unknown as Record<string, unknown>;
  const explicit = resolveWidgetLangOrNull(w.HELVION_WIDGET_LANG);
  if (explicit) return explicit;

  // Helvion public site uses this cookie for i18n, so carry it into the widget.
  const cookie = resolveWidgetLangOrNull(getCookie("helvino_lang"));
  if (cookie) return cookie;

  // Next: follow the host page <html lang=".."> if present (changes when user switches language)
  const htmlLang = resolveWidgetLangOrNull(document.documentElement?.lang || "");
  if (htmlLang) return htmlLang;

  // Don't force documentElement.lang by default (can conflict with an explicitly
  // configured widget language on customer sites).
  return null;
}

// ── Theme map (matches API's THEME_COLORS — 12 themes) ──
const THEME_MAP: Record<string, string> = {
  amber: "#F59E0B", ocean: "#0EA5E9", emerald: "#10B981", violet: "#8B5CF6",
  rose: "#F43F5E", slate: "#475569", teal: "#14B8A6", indigo: "#6366F1",
  sunset: "#F97316", aurora: "#06B6D4", midnight: "#1E293B", cherry: "#BE123C",
};

function isHexColor(v: string): boolean { return /^#[0-9a-fA-F]{6}$/.test(v); }

function ensureEmbedCssLoaded(): void {
  try {
    if (document.querySelector('link[data-helvion-widget-css="1"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `${FRAME_ORIGIN}/embed.css${embedVersion ? `?v=${encodeURIComponent(embedVersion)}` : ""}`;
    link.setAttribute("data-helvion-widget-css", "1");
    document.head.appendChild(link);
  } catch { /* */ }
}

function getSiteId(): string {
  const w = window as unknown as Record<string, unknown>;
  if (typeof w.HELVION_SITE_ID === "string" && w.HELVION_SITE_ID) return w.HELVION_SITE_ID;
  const script = document.querySelector<HTMLScriptElement>("script[data-site]");
  if (script) return script.dataset.site || "";
  return "";
}

function isMobile(): boolean {
  // matchMedia is more reliable on mobile browsers (esp. iOS Safari) than innerWidth.
  try {
    if (typeof window.matchMedia === "function") {
      return window.matchMedia("(max-width: 768px)").matches;
    }
  } catch { /* */ }
  return window.innerWidth <= 768;
}

// ── Launcher settings parsed from bootloader/live update ──
interface LauncherConfig {
  primaryColor: string;
  launcherId: string;   // "rounded" | "squircle" | "pill" | "bar"
  positionId: string;   // "br" | "bl"
  launcherLabel: string;
  attGrabberId: string; // "none" | "wave" | "message" | "bounce" | "pulse"
  attGrabberText: string;
  attGrabberDelay: number;
}

function mapLegacyLauncherId(raw: string): string {
  const v = raw.trim().toLowerCase();
  if (v === "pill") return "pill";
  if (v === "bar") return "bar";
  if (v === "squircle") return "squircle";
  // legacy "bubble" and unknowns default to "rounded"
  return "rounded";
}

function parseConfig(ws: Record<string, unknown>): LauncherConfig {
  const themeId = typeof ws.themeId === "string" ? ws.themeId.trim().toLowerCase() : "";
  const useCustom = ws.useCustomColor === true;
  const custom = typeof ws.customColor === "string" ? ws.customColor.trim() : "";
  const wsPC = typeof ws.primaryColor === "string" ? ws.primaryColor.trim() : "";

  let primaryColor = "";
  if (useCustom && custom && isHexColor(custom)) primaryColor = custom;
  else if (wsPC && isHexColor(wsPC)) primaryColor = wsPC;
  else if (themeId && THEME_MAP[themeId]) primaryColor = THEME_MAP[themeId]!;

  return {
    primaryColor: primaryColor || "#8B5CF6",
    launcherId:
      typeof ws.launcherId === "string"
        ? ws.launcherId
        : (typeof (ws as any).launcher === "string" ? mapLegacyLauncherId(String((ws as any).launcher)) : "rounded"),
    positionId:
      typeof ws.positionId === "string"
        ? ws.positionId
        : (String((ws as any).position || "").toLowerCase() === "left" ? "bl" : "br"),
    launcherLabel: typeof ws.launcherLabel === "string" ? ws.launcherLabel : "Bize yazın",
    attGrabberId: typeof ws.attGrabberId === "string" ? ws.attGrabberId : "none",
    attGrabberText: typeof ws.attGrabberText === "string" ? ws.attGrabberText : "",
    attGrabberDelay: typeof ws.attGrabberDelay === "number" ? ws.attGrabberDelay : 5,
  };
}

// ── State ──
let isOpen = false;
let container: HTMLDivElement | null = null;
let frameEl: HTMLIFrameElement | null = null;
let launcher: HTMLDivElement | null = null;
let attGrabberEl: HTMLDivElement | null = null;
let pulseRing: HTMLDivElement | null = null;
let savedScrollY = 0;
let currentConfig: LauncherConfig | null = null;
let attGrabberTimer: number | null = null;
let attGrabberDismissed = false;
let currentLang: WidgetLang = "tr";
let hostLang: WidgetLang | null = null;
let destroyed = false;
const embedVersion = getEmbedVersionParam();
// Always bust iframe HTML caching (CDNs can be sticky). If the embed script
// already has a version param, reuse it; otherwise use a per-page-load value.
const frameVersion = embedVersion || String(Date.now());

function postHostLangToFrame(newLang: WidgetLang): void {
  try {
    frameEl?.contentWindow?.postMessage({ type: "helvion:host-lang", language: newLang }, "*");
  } catch {
    // cross-origin safety
  }
}

function setResolvedLang(newLang: WidgetLang): void {
  if (newLang === currentLang) return;
  currentLang = newLang;
  syncLauncherAria();
  postHostLangToFrame(newLang);
}

function syncLauncherVisibility(): void {
  if (!launcher) return;
  // On mobile fullscreen, the launcher can sit on top of the iframe and block the
  // send button area. Hide + disable it while chat is open on mobile.
  const hide = isOpen && isMobile();
  // Use display:none to guarantee it won't render above the iframe.
  launcher.style.display = hide ? "none" : "flex";
  launcher.style.pointerEvents = hide ? "none" : "auto";
  launcher.style.opacity = hide ? "0" : "1";
  launcher.style.zIndex = String(hide ? (Z_TOP - 2) : Z_TOP);
  if (hide) {
    // Also hide any attention/pulse artifacts while fullscreen is open.
    if (pulseRing) pulseRing.style.display = "none";
    if (attGrabberEl) attGrabberEl.classList.remove("helvion-att-visible");
  }
}

function syncLauncherAria(): void {
  if (!launcher) return;
  launcher.setAttribute("aria-label", isOpen ? tWidget(currentLang, "closeChat") : tWidget(currentLang, "openChat"));
}

function lockBody(): void {
  savedScrollY = window.scrollY;
  const s = document.body.style;
  const h = document.documentElement.style;
  s.overflow = "hidden";
  s.position = "fixed";
  s.top = `-${savedScrollY}px`;
  s.left = "0";
  s.right = "0";
  s.width = "100%";
  h.overflow = "hidden";
  try {
    (s as any).overscrollBehavior = "none";
    (h as any).overscrollBehavior = "none";
  } catch { /* older browsers */ }

  // Block touch scroll on host page so the underlying site doesn't shift.
  // The iframe itself handles its own touch events independently.
  document.addEventListener("touchmove", blockTouch, { passive: false });
}

function unlockBody(): void {
  const s = document.body.style;
  const h = document.documentElement.style;
  s.overflow = "";
  s.position = "";
  s.top = "";
  s.left = "";
  s.right = "";
  s.width = "";
  h.overflow = "";
  try {
    (s as any).overscrollBehavior = "";
    (h as any).overscrollBehavior = "";
  } catch { /* older browsers */ }
  document.removeEventListener("touchmove", blockTouch);
  window.scrollTo(0, savedScrollY);
}

function blockTouch(e: TouchEvent): void {
  // Only block touches on the host page (not inside the iframe).
  // Touches inside the iframe don't propagate to the host document.
  e.preventDefault();
}

function toggle(): void {
  if (!container || !launcher) return;
  isOpen = !isOpen;
  syncLauncherAria();
  syncLauncherVisibility();

  if (isOpen) {
    hideAttGrabber();
    container.style.display = "block";
    void container.offsetHeight;
    container.classList.add("helvion-open");
    launcher.classList.add("helvion-launcher--active");
    if (isMobile()) lockBody();
  } else {
    container.classList.remove("helvion-open");
    launcher.classList.remove("helvion-launcher--active");
    if (isMobile()) unlockBody();
    setTimeout(() => { if (!isOpen && container) container.style.display = "none"; }, 300);
  }
}

function destroyWidget(): void {
  if (destroyed) return;
  destroyed = true;
  try { window.removeEventListener("message", onFrameMessage); } catch { /* */ }
  try { window.removeEventListener("resize", onResize); } catch { /* */ }
  try { window.removeEventListener("orientationchange", onResize); } catch { /* */ }
  try { if (isOpen) unlockBody(); } catch { /* */ }
  try { launcher?.remove(); } catch { /* */ }
  try { container?.remove(); } catch { /* */ }
  try { attGrabberEl?.remove(); } catch { /* */ }
  try { pulseRing?.remove(); } catch { /* */ }
  launcher = null;
  container = null;
  frameEl = null;
  attGrabberEl = null;
  pulseRing = null;
  currentConfig = null;
}

// ── Attention grabber ──
function hideAttGrabber(): void {
  if (attGrabberEl) attGrabberEl.classList.remove("helvion-att-visible");
  if (pulseRing) pulseRing.style.display = "none";
  if (launcher) {
    launcher.classList.remove("helvion-anim-bounce", "helvion-anim-wave");
  }
}

function showAttGrabber(cfg: LauncherConfig): void {
  if (isOpen || attGrabberDismissed || cfg.attGrabberId === "none") return;

  const isLeft = cfg.positionId === "bl";

  if (cfg.attGrabberId === "message" && cfg.attGrabberText) {
    if (!attGrabberEl) {
      attGrabberEl = document.createElement("div");
      attGrabberEl.id = "helvion-att-grabber";
      document.body.appendChild(attGrabberEl);
    }
    attGrabberEl.innerHTML = `
      <div class="helvion-att-bubble">
        ${cfg.attGrabberText.replace(/</g, "&lt;")}
        <button class="helvion-att-close" aria-label="${tWidget(currentLang, "closeChat")}">&times;</button>
      </div>
    `;
    attGrabberEl.classList.toggle("helvion-att-left", isLeft);
    if (isLeft) {
      attGrabberEl.style.right = "auto";
      attGrabberEl.style.left = "24px";
    } else {
      attGrabberEl.style.left = "auto";
      attGrabberEl.style.right = "24px";
    }
    attGrabberEl.classList.add("helvion-att-visible");
    const closeBtn = attGrabberEl.querySelector(".helvion-att-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        attGrabberDismissed = true;
        hideAttGrabber();
      });
    }
    attGrabberEl.addEventListener("click", () => { if (!isOpen) toggle(); });
  }

  if (cfg.attGrabberId === "bounce" && launcher) {
    launcher.classList.add("helvion-anim-bounce");
    launcher.addEventListener("animationend", () => {
      launcher!.classList.remove("helvion-anim-bounce");
    }, { once: true });
  }

  if (cfg.attGrabberId === "wave" && launcher) {
    launcher.classList.add("helvion-anim-wave");
    launcher.addEventListener("animationend", () => {
      launcher!.classList.remove("helvion-anim-wave");
    }, { once: true });
  }

  if (cfg.attGrabberId === "pulse") {
    if (!pulseRing) {
      pulseRing = document.createElement("div");
      pulseRing.id = "helvion-pulse-ring";
      document.body.appendChild(pulseRing);
    }
    pulseRing.style.borderColor = cfg.primaryColor;
    pulseRing.classList.toggle("helvion-pulse-left", isLeft);
    if (isLeft) {
      pulseRing.style.right = "auto";
      pulseRing.style.left = launcher?.style.left || "20px";
    } else {
      pulseRing.style.left = "auto";
      pulseRing.style.right = launcher?.style.right || "20px";
    }
    pulseRing.style.bottom = launcher?.style.bottom || "20px";
    pulseRing.style.width = launcher?.style.width || "56px";
    pulseRing.style.height = launcher?.style.height || "56px";
    pulseRing.style.borderRadius = launcher?.style.borderRadius || "50%";
    pulseRing.style.display = "block";
  }
}

function scheduleAttGrabber(cfg: LauncherConfig): void {
  if (attGrabberTimer) { window.clearTimeout(attGrabberTimer); attGrabberTimer = null; }
  if (cfg.attGrabberId === "none") return;
  const delayMs = Math.max(0, (cfg.attGrabberDelay || 5)) * 1000;
  attGrabberTimer = window.setTimeout(() => showAttGrabber(cfg), delayMs);
}

// ── Apply launcher settings ──
function applyConfig(cfg: LauncherConfig): void {
  currentConfig = cfg;
  if (!launcher || !container) return;

  const isLeft = cfg.positionId === "bl";
  const mobile = isMobile();
  const edgePx = mobile ? "16px" : "20px";

  // Color
  launcher.style.background = cfg.primaryColor;
  launcher.style.boxShadow = `0 4px 14px ${cfg.primaryColor}40`;

  // Shape
  const labelEl = launcher.querySelector<HTMLElement>(".helvion-launcher-label");
  switch (cfg.launcherId) {
    case "squircle":
      launcher.style.width = "56px";
      launcher.style.height = "56px";
      launcher.style.borderRadius = "16px";
      if (labelEl) labelEl.style.display = "none";
      break;
    case "pill":
      launcher.style.width = "auto";
      launcher.style.minWidth = "120px";
      launcher.style.height = "48px";
      launcher.style.borderRadius = "28px";
      launcher.style.padding = "0 20px";
      if (labelEl) {
        labelEl.textContent = cfg.launcherLabel || "Bize yazın";
        labelEl.style.display = "inline";
      }
      break;
    case "bar":
      launcher.style.width = "auto";
      launcher.style.minWidth = "150px";
      launcher.style.height = "44px";
      launcher.style.borderRadius = "14px";
      launcher.style.padding = "0 18px";
      if (labelEl) {
        labelEl.textContent = cfg.launcherLabel || "Bize yazın";
        labelEl.style.display = "inline";
      }
      break;
    default: // "rounded"
      launcher.style.width = "56px";
      launcher.style.height = "56px";
      launcher.style.borderRadius = "50%";
      launcher.style.padding = "0";
      if (labelEl) labelEl.style.display = "none";
      break;
  }

  // Position
  if (isLeft) {
    launcher.style.right = "auto";
    launcher.style.left = edgePx;
  } else {
    launcher.style.left = "auto";
    launcher.style.right = edgePx;
  }

  // On mobile: clear ALL inline position styles so CSS !important rules take over
  // (fullscreen via top/left/right/bottom: 0 !important in loader.css).
  // On desktop: position the chat popup next to the launcher.
  if (mobile) {
    container.style.left = "";
    container.style.right = "";
    container.style.top = "";
    container.style.bottom = "";
    container.style.width = "";
    container.style.height = "";
    container.style.borderRadius = "";
  } else if (isLeft) {
    container.style.right = "auto";
    container.style.left = edgePx;
  } else {
    container.style.left = "auto";
    container.style.right = edgePx;
  }

  // Attention grabber
  hideAttGrabber();
  attGrabberDismissed = false;
  scheduleAttGrabber(cfg);

  // Reveal
  // Respect mobile-open visibility rules (launcher should not block iframe UI).
  syncLauncherVisibility();
}

// ── Build launcher DOM ──
function createLauncher(): HTMLDivElement {
  const el = document.createElement("div");
  el.id = "helvion-launcher";
  el.setAttribute("role", "button");
  // language is resolved after bootloader, but set a safe default now
  el.setAttribute("aria-label", tWidget(currentLang, "openChat"));
  el.setAttribute("tabindex", "0");
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><svg class="helvion-close-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg><span class="helvion-launcher-label"></span>`;
  el.style.zIndex = String(Z_TOP);
  el.style.opacity = "0";
  el.style.transition = "opacity 200ms ease, transform 200ms ease, box-shadow 200ms ease, width 300ms ease, height 300ms ease, border-radius 300ms ease";
  el.addEventListener("click", toggle);
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
  });
  return el;
}

function createContainer(siteId: string): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.id = "helvion-container";
  wrap.style.zIndex = String(Z_TOP - 1);
  wrap.style.display = "none";

  const iframe = document.createElement("iframe");
  iframe.id = "helvion-frame";
  frameEl = iframe;
  let parentHost = "";
  try { parentHost = window.location.host || ""; } catch { /* */ }
  const qs = new URLSearchParams();
  qs.set("siteId", siteId);
  if (parentHost) qs.set("parentHost", parentHost);
  if (hostLang) qs.set("hl", hostLang);
  qs.set("v", frameVersion);
  iframe.src = `${FRAME_ORIGIN}/widget-v2/frame.html?${qs.toString()}`;
  iframe.setAttribute("allow", "microphone; camera; clipboard-write");
  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-popups");
  iframe.title = "Helvion Chat";

  wrap.appendChild(iframe);
  return wrap;
}

// ── Bootloader fetch ──
// The loader fetches the bootloader independently for fast launcher styling.
// However, this is a CROSS-ORIGIN request (host page → api.helvion.io) and may
// fail due to CORS on customer websites. The iframe also fetches the bootloader
// (same-origin, always works) and forwards settings via postMessage.
// CRITICAL: On failure, only apply defaults if the iframe hasn't sent settings yet.
async function fetchAndApply(siteId: string): Promise<void> {
  const fallbackTimer = window.setTimeout(() => {
    if (!currentConfig) applyConfig(parseConfig({}));
  }, 3000);

  try {
    const res = await fetch(`${FRAME_ORIGIN}/api/bootloader?siteId=${encodeURIComponent(siteId)}`, {
      method: "GET",
      headers: { "x-site-id": siteId },
    });
    const data = await res.json().catch(() => null);
    window.clearTimeout(fallbackTimer);
    if (!res.ok || !data) {
      // Only use defaults if iframe hasn't already provided correct settings
      if (!currentConfig) applyConfig(parseConfig({}));
      return;
    }
    if (data?.config?.widgetEnabled === false) {
      destroyWidget();
      return;
    }
    // If host page provided a locale, keep launcher aria consistent with it.
    const langNow = hostLang || resolveWidgetLang(data?.config?.language);
    setResolvedLang(langNow);
    const ws = (data?.config?.widgetSettings || {}) as Record<string, unknown>;
    applyConfig(parseConfig(ws));
  } catch {
    window.clearTimeout(fallbackTimer);
    // CORS failure on customer websites is expected — the iframe will forward
    // the correct settings via postMessage. Don't overwrite with defaults.
    if (!currentConfig) applyConfig(parseConfig({}));
  }
}

// ── Frame messages (close + live settings update) ──
function onFrameMessage(e: MessageEvent): void {
  if (e.origin !== FRAME_ORIGIN && e.origin !== window.location.origin) return;

  if (e.data === "helvion:close") {
    if (isOpen) toggle();
  }

  if (e.data?.type === "helvion:config-update") {
    if (e.data?.config?.widgetEnabled === false) {
      destroyWidget();
      return;
    }
    if (e.data.settings) {
      const ws = e.data.settings as Record<string, unknown>;
      applyConfig(parseConfig(ws));
    }
    // Update language from live config (iframe forwards the resolved language)
    if (typeof e.data.language === "string") {
      currentLang = resolveWidgetLang(e.data.language);
      syncLauncherAria();
    }
  }
}

// ── Handle orientation/resize changes ──
let resizeTimer: number | null = null;
function onResize(): void {
  if (resizeTimer) window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    if (currentConfig) applyConfig(currentConfig);
  }, 150);
}

// ── Init ──
function init(): void {
  if (document.getElementById("helvion-launcher")) return;
  ensureEmbedCssLoaded();

  hostLang = getHostLang();
  if (hostLang) {
    currentLang = hostLang;
  }

  const siteId = getSiteId();
  if (!siteId) {
    console.warn("[Helvion] No siteId found. Add data-site to the script tag or set window.HELVION_SITE_ID.");
    return;
  }

  launcher = createLauncher();
  container = createContainer(siteId);

  document.body.appendChild(container);
  document.body.appendChild(launcher);

  window.addEventListener("message", onFrameMessage);
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);

  // Follow runtime language changes on the host page (e.g. app language switcher).
  try {
    let last = hostLang || currentLang;
    const obs = new MutationObserver(() => {
      const next = getHostLang();
      if (!next) return;
      if (next === last) return;
      last = next;
      hostLang = next;
      setResolvedLang(next);
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  } catch {
    // non-fatal
  }

  void fetchAndApply(siteId);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
