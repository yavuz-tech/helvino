import "./loader.css";
import { resolveWidgetLang, tWidget, type WidgetLang } from "./i18n";

const FRAME_ORIGIN = "https://api.helvion.io";
const Z_TOP = 2147483647;

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
    let v = "";
    try {
      const cs = document.currentScript as HTMLScriptElement | null;
      const src = cs?.src || "";
      if (src) { const u = new URL(src); v = u.searchParams.get("v") || ""; }
    } catch { /* */ }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `${FRAME_ORIGIN}/embed.css${v ? `?v=${encodeURIComponent(v)}` : ""}`;
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

function isMobile(): boolean { return window.innerWidth <= 768; }

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
    launcherId: typeof ws.launcherId === "string" ? ws.launcherId : "rounded",
    positionId: typeof ws.positionId === "string" ? ws.positionId : "br",
    launcherLabel: typeof ws.launcherLabel === "string" ? ws.launcherLabel : "Bize yazın",
    attGrabberId: typeof ws.attGrabberId === "string" ? ws.attGrabberId : "none",
    attGrabberText: typeof ws.attGrabberText === "string" ? ws.attGrabberText : "",
    attGrabberDelay: typeof ws.attGrabberDelay === "number" ? ws.attGrabberDelay : 5,
  };
}

// ── State ──
let isOpen = false;
let container: HTMLDivElement | null = null;
let launcher: HTMLDivElement | null = null;
let attGrabberEl: HTMLDivElement | null = null;
let pulseRing: HTMLDivElement | null = null;
let savedScrollY = 0;
let currentConfig: LauncherConfig | null = null;
let attGrabberTimer: number | null = null;
let attGrabberDismissed = false;
let currentLang: WidgetLang = "tr";

function syncLauncherAria(): void {
  if (!launcher) return;
  launcher.setAttribute("aria-label", isOpen ? tWidget(currentLang, "closeChat") : tWidget(currentLang, "openChat"));
}

function lockBody(): void {
  savedScrollY = window.scrollY;
  document.body.style.overflow = "hidden";
  document.body.style.position = "fixed";
  document.body.style.top = `-${savedScrollY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
}

function unlockBody(): void {
  document.body.style.overflow = "";
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  window.scrollTo(0, savedScrollY);
}

function toggle(): void {
  if (!container || !launcher) return;
  isOpen = !isOpen;
  syncLauncherAria();

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
    launcher.style.left = "20px";
    container.style.right = "auto";
    container.style.left = "20px";
  } else {
    launcher.style.left = "auto";
    launcher.style.right = "20px";
    container.style.left = "auto";
    container.style.right = "20px";
  }

  // Attention grabber
  hideAttGrabber();
  attGrabberDismissed = false;
  scheduleAttGrabber(cfg);

  // Reveal
  launcher.style.opacity = "1";
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
  let parentHost = "";
  try { parentHost = window.location.host || ""; } catch { /* */ }
  const qs = new URLSearchParams();
  qs.set("siteId", siteId);
  if (parentHost) qs.set("parentHost", parentHost);
  iframe.src = `${FRAME_ORIGIN}/widget-v2/frame.html?${qs.toString()}`;
  iframe.setAttribute("allow", "microphone; camera; clipboard-write");
  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-popups");
  iframe.title = "Helvion Chat";

  wrap.appendChild(iframe);
  return wrap;
}

// ── Bootloader fetch ──
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
    if (!res.ok || !data) { applyConfig(parseConfig({})); return; }
    currentLang = resolveWidgetLang(data?.config?.language);
    syncLauncherAria();
    const ws = (data?.config?.widgetSettings || {}) as Record<string, unknown>;
    applyConfig(parseConfig(ws));
  } catch {
    window.clearTimeout(fallbackTimer);
    applyConfig(parseConfig({}));
  }
}

// ── Frame messages (close + live settings update) ──
function onFrameMessage(e: MessageEvent): void {
  if (e.origin !== FRAME_ORIGIN && e.origin !== window.location.origin) return;

  if (e.data === "helvion:close") {
    if (isOpen) toggle();
  }

  if (e.data?.type === "helvion:config-update" && e.data.settings) {
    const ws = e.data.settings as Record<string, unknown>;
    applyConfig(parseConfig(ws));
  }
}

// ── Init ──
function init(): void {
  if (document.getElementById("helvion-launcher")) return;
  ensureEmbedCssLoaded();

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

  void fetchAndApply(siteId);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
