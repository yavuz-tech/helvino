/**
 * Helvion Widget Loader (HOST PAGE)
 *
 * Responsibilities:
 * - Create the fixed launcher button
 * - Create the iframe container for the chat UI
 * - Handle open/close, mobile scroll lock, and postMessage close from iframe
 *
 * IMPORTANT:
 * This file MUST NOT import the React widget UI to avoid injecting UI CSS
 * into customer websites. The UI runs inside an iframe.
 */

import "./loader.css";
import { API_URL, loadBootloader } from "./api";
import { getVisitorId } from "./utils/visitor";

console.log("[HELVION EMBED] Build version: 2026-02-16-v2");

const ROOT_ID = "helvion-widget-root";
const IFRAME_WRAP_CLASS = "helvion-iframe-wrap";
const IFRAME_CLASS = "helvion-iframe";
const LAUNCHER_CLASS = "helvion-launcher";
const LOADING_CLASS = "helvion-iframe-loading";

type ScrollLockState = {
  scrollY: number;
  overflow: string;
  position: string;
  width: string;
  top: string;
} | null;

let scrollLockState: ScrollLockState = null;
let isOpen = false;
let iframeLoaded = false;

function isMobileViewport() {
  return window.innerWidth <= 768;
}

function setIframeLoading(root: HTMLElement, loading: boolean) {
  const wrap = root.querySelector(`.${IFRAME_WRAP_CLASS}`) as HTMLElement | null;
  if (!wrap) return;
  const spinner = wrap.querySelector(`.${LOADING_CLASS}`) as HTMLElement | null;
  const iframe = wrap.querySelector(`.${IFRAME_CLASS}`) as HTMLIFrameElement | null;
  if (spinner) spinner.style.display = loading ? "flex" : "none";
  if (iframe) iframe.style.opacity = loading ? "0" : "1";
}

function applyRootInlineStyle(root: HTMLElement) {
  // If embed.css is blocked by CSP, ensure the root still behaves like Crisp/Tidio:
  // fixed overlay anchor with pointer-events disabled (children are fixed too).
  root.style.position = "fixed";
  root.style.top = "0";
  root.style.left = "0";
  root.style.width = "0";
  root.style.height = "0";
  root.style.overflow = "visible";
  root.style.zIndex = "2147483647";
  root.style.pointerEvents = "none";
}

function applyLauncherInlineStyle(btn: HTMLButtonElement, root: HTMLElement) {
  const primary = root.style.getPropertyValue("--primary-color")?.trim() || "#8B5CF6";
  const dark = root.style.getPropertyValue("--primary-dark")?.trim() || "#7C3AED";
  const mobile = isMobileViewport();
  const size = mobile ? 56 : 60;
  const right = mobile ? 16 : 20;
  const bottom = mobile ? 16 : 20;

  btn.style.pointerEvents = "auto";
  btn.style.position = "fixed";
  btn.style.right = `${right}px`;
  btn.style.bottom = `${bottom}px`;
  btn.style.width = `${size}px`;
  btn.style.height = `${size}px`;
  btn.style.borderRadius = "50%";
  btn.style.border = "none";
  btn.style.padding = "0";
  btn.style.cursor = "pointer";
  btn.style.color = "#fff";
  btn.style.background = `linear-gradient(135deg, ${primary}, ${dark})`;
  btn.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
  btn.style.display = "flex";
  btn.style.alignItems = "center";
  btn.style.justifyContent = "center";
  btn.style.willChange = "transform, opacity";
  btn.style.transform = "translateZ(0)";
  (btn.style as any).webkitTransform = "translateZ(0)";
}

function applyWrapInlineStyle(wrap: HTMLElement) {
  const mobile = isMobileViewport();

  wrap.style.pointerEvents = "none"; // enabled only when open
  wrap.style.position = "fixed";
  wrap.style.background = "#fff";
  wrap.style.overflow = "hidden";
  wrap.style.zIndex = "2147483646";

  if (mobile) {
    wrap.style.top = "0";
    wrap.style.left = "0";
    wrap.style.right = "0";
    wrap.style.bottom = "0";
    wrap.style.width = "100%";
    wrap.style.maxWidth = "100vw";
    wrap.style.height = "100%";
    wrap.style.borderRadius = "0";
    wrap.style.boxShadow = "none";
    wrap.style.transition = "transform 300ms cubic-bezier(0.4, 0, 0.2, 1)";
    wrap.style.transform = isOpen ? "translate3d(0,0,0)" : "translate3d(0,100%,0)";
  } else {
    wrap.style.right = "20px";
    wrap.style.bottom = "96px";
    wrap.style.width = "380px";
    wrap.style.height = "600px";
    wrap.style.minHeight = "400px";
    wrap.style.maxHeight = "calc(100vh - 120px)";
    wrap.style.borderRadius = "16px";
    wrap.style.boxShadow = "0 8px 32px rgba(0,0,0,0.12)";
    wrap.style.transformOrigin = "bottom right";
    wrap.style.transition =
      "opacity 250ms cubic-bezier(0.4,0,0.2,1), transform 250ms cubic-bezier(0.4,0,0.2,1)";
    wrap.style.opacity = isOpen ? "1" : "0";
    wrap.style.transform = isOpen ? "translate3d(0,0,0) scale(1)" : "translate3d(0,20px,0) scale(0.95)";
  }
}

function clampHexColor(c: string | undefined | null): string | null {
  if (!c) return null;
  const s = String(c).trim();
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s : null;
}

function darken(hex: string, amt = 0.15): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const d = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 - amt))));
  const toHex = (v: number) => v.toString(16).padStart(2, "0");
  return `#${toHex(d(r))}${toHex(d(g))}${toHex(d(b))}`;
}

function ensureRoot(): HTMLElement {
  let root = document.getElementById(ROOT_ID);
  if (!root) {
    root = document.createElement("div");
    root.id = ROOT_ID;
    root.setAttribute("data-helvion-widget-root", "1");
    document.body.appendChild(root);
  }
  return root;
}

function lockScrollIfMobile() {
  if (window.innerWidth > 768) return;
  if (scrollLockState) return;
  const scrollY = window.scrollY;
  scrollLockState = {
    scrollY,
    overflow: document.body.style.overflow,
    position: document.body.style.position,
    width: document.body.style.width,
    top: document.body.style.top,
  };
  document.body.style.overflow = "hidden";
  document.body.style.position = "fixed";
  document.body.style.width = "100%";
  document.body.style.top = `-${scrollY}px`;
}

function unlockScroll() {
  if (!scrollLockState) return;
  const { scrollY, overflow, position, width, top } = scrollLockState;
  document.body.style.overflow = overflow;
  document.body.style.position = position;
  document.body.style.width = width;
  document.body.style.top = top;
  window.scrollTo(0, scrollY);
  scrollLockState = null;
}

function setOpen(root: HTMLElement, open: boolean) {
  const wrap = root.querySelector(`.${IFRAME_WRAP_CLASS}`) as HTMLElement | null;
  if (!wrap) return;
  isOpen = open;
  wrap.classList.toggle("open", open);
  const launcher = root.querySelector(`.${LAUNCHER_CLASS}`) as HTMLButtonElement | null;
  if (launcher) launcher.setAttribute("aria-expanded", open ? "true" : "false");
  if (open) lockScrollIfMobile();
  else unlockScroll();

  // Inline fallback for when embed.css is blocked by CSP.
  // Keep open/close animations consistent.
  applyWrapInlineStyle(wrap);
  if (open) {
    wrap.style.pointerEvents = "auto";
    // Ensure iframe can receive keyboard/mouse events when widget is open.
    const iframe = wrap.querySelector(`.${IFRAME_CLASS}`) as HTMLIFrameElement | null;
    if (iframe) {
      iframe.style.pointerEvents = "auto";
      // Defer focus so the iframe's inner input can be focused by the user.
      requestAnimationFrame(() => { try { iframe.focus(); } catch {} });
    }
  } else {
    wrap.style.pointerEvents = "none";
  }
}

function buildFrameUrl() {
  const w = window as any;
  const siteId = w.HELVION_SITE_ID || w.HELVINO_SITE_ID || "";
  const orgKey = w.HELVION_ORG_KEY || w.HELVINO_ORG_KEY || "";
  const parentHost = window.location.hostname;

  const u = new URL(`${API_URL}/widget-frame.html`);
  if (siteId) u.searchParams.set("siteId", siteId);
  if (orgKey) u.searchParams.set("orgKey", orgKey);
  u.searchParams.set("parentHost", parentHost);
  return u.toString();
}

function createLauncher(root: HTMLElement) {
  const btn = document.createElement("button");
  btn.className = LAUNCHER_CLASS;
  btn.type = "button";
  btn.setAttribute("aria-label", "Open chat");
  btn.setAttribute("aria-expanded", "false");
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 5h16v10H8l-4 4V5z" stroke="white" stroke-width="2" stroke-linejoin="round"/>
    </svg>
  `;
  btn.addEventListener("click", () => {
    setOpen(root, !isOpen);
  });
  // Inline fallback so launcher is visible even if CSS is blocked.
  applyLauncherInlineStyle(btn, root);
  // Start hidden — hydrateTheme() reveals with the correct brand color.
  btn.style.opacity = "0";
  btn.style.transition = "opacity 250ms ease";
  root.appendChild(btn);
}

function createIframe(root: HTMLElement) {
  const wrap = document.createElement("div");
  wrap.className = IFRAME_WRAP_CLASS;
  wrap.setAttribute("role", "dialog");
  wrap.setAttribute("aria-label", "Helvion chat widget");

  const loading = document.createElement("div");
  loading.className = LOADING_CLASS;
  loading.setAttribute("aria-hidden", "true");
  loading.style.position = "absolute";
  loading.style.inset = "0";
  loading.style.display = "none";
  loading.style.alignItems = "center";
  loading.style.justifyContent = "center";
  loading.style.pointerEvents = "none";
  loading.style.background = "rgba(255,255,255,0.9)";

  const spinner = document.createElement("div");
  spinner.style.width = "32px";
  spinner.style.height = "32px";
  spinner.style.borderRadius = "50%";
  spinner.style.border = "3px solid rgba(0,0,0,0.15)";
  spinner.style.borderTopColor = root.style.getPropertyValue("--primary-color")?.trim() || "#8B5CF6";
  spinner.style.willChange = "transform";
  loading.appendChild(spinner);
  try {
    spinner.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }], {
      duration: 900,
      iterations: Infinity,
    });
  } catch {}

  const iframe = document.createElement("iframe");
  iframe.className = IFRAME_CLASS;
  iframe.setAttribute("title", "Helvion Widget");
  iframe.setAttribute("allow", "clipboard-write");
  iframe.setAttribute("tabindex", "0");
  // Ensure iframe fills container and never overflows.
  iframe.style.width = "100%";
  iframe.style.maxWidth = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "none";
  iframe.style.overflow = "hidden";
  iframe.style.display = "block";
  iframe.style.opacity = "0";
  iframe.style.transition = "opacity 180ms ease";
  iframe.addEventListener("load", () => {
    setIframeLoading(root, false);
    try { window.parent?.postMessage({ type: "helvion:frame-ready" }, "*"); } catch {}
  });

  wrap.appendChild(loading);
  wrap.appendChild(iframe);
  // Inline fallback so the container positions correctly without CSS.
  applyWrapInlineStyle(wrap);
  root.appendChild(wrap);
}

function revealLauncher(root: HTMLElement) {
  const launcher = root.querySelector(`.${LAUNCHER_CLASS}`) as HTMLButtonElement | null;
  if (launcher) launcher.style.opacity = "1";
}

async function hydrateTheme(root: HTMLElement) {
  // Fallback: reveal launcher with default colors after 3s even if bootloader fails.
  const fallbackTimer = setTimeout(() => revealLauncher(root), 3000);

  try {
    // Ensure parentHost is passed for allowlist checks in the bootloader.
    (window as any).HELVION_PARENT_HOST = window.location.hostname;
    (window as any).HELVINO_PARENT_HOST = (window as any).HELVION_PARENT_HOST;
    // Ensure visitor id exists early.
    getVisitorId();
    const cfg = await loadBootloader();
    const ws: any = cfg?.config?.widgetSettings || {};
    const theme: any = cfg?.config?.theme || {};
    const primary = clampHexColor(ws?.primaryColor) || clampHexColor(theme?.primaryColor) || "#8B5CF6";
    const primaryDark =
      clampHexColor(ws?.primaryColorDark) ||
      clampHexColor(theme?.primaryColorDark) ||
      darken(primary, 0.15);
    root.style.setProperty("--primary-color", primary);
    root.style.setProperty("--primary-dark", primaryDark);

    // Apply bootloader theme to launcher and reveal with correct brand color.
    const launcher = root.querySelector(`.${LAUNCHER_CLASS}`) as HTMLButtonElement | null;
    if (launcher) applyLauncherInlineStyle(launcher, root);
    const loadingSpinner = root.querySelector(`.${LOADING_CLASS} > div`) as HTMLElement | null;
    if (loadingSpinner) loadingSpinner.style.borderTopColor = primary;

    clearTimeout(fallbackTimer);
    revealLauncher(root);
  } catch {
    // Best-effort: reveal launcher with defaults.
    clearTimeout(fallbackTimer);
    revealLauncher(root);
  }
}

function setupPostMessageClose(root: HTMLElement) {
  window.addEventListener("message", (ev) => {
    const d = ev?.data;
    if (!d || typeof d !== "object") return;
    if ((d as any).type === "helvion:close") {
      setOpen(root, false);
    }
  });
}

function init() {
  // Ensure loader CSS is applied (Vite extracts CSS as a separate asset in prod build).
  try {
    const href = `${API_URL}/embed.css`;
    const existing = document.querySelector(`link[data-helvion-embed-css="1"]`) as HTMLLinkElement | null;
    if (!existing) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.setAttribute("data-helvion-embed-css", "1");
      document.head.appendChild(link);
    }
  } catch {}

  const w = window as any;
  if (!w.HELVION_SITE_ID && w.HELVINO_SITE_ID) w.HELVION_SITE_ID = w.HELVINO_SITE_ID;
  if (!w.HELVION_ORG_KEY && w.HELVINO_ORG_KEY) w.HELVION_ORG_KEY = w.HELVINO_ORG_KEY;

  if (!w.HELVION_SITE_ID && !w.HELVION_ORG_KEY) {
    // Keep error minimal in production embed scenario.
    // eslint-disable-next-line no-console
    console.error("Helvion Widget: HELVION_SITE_ID (or HELVION_ORG_KEY) must be set before loading embed.js");
    return;
  }

  const root = ensureRoot();
  applyRootInlineStyle(root);
  createIframe(root);
  createLauncher(root);
  setupPostMessageClose(root);
  hydrateTheme(root);

  // Preload iframe immediately so content is ready when user clicks launcher.
  const preloadIframe = root.querySelector(`.${IFRAME_CLASS}`) as HTMLIFrameElement | null;
  if (preloadIframe && !iframeLoaded) {
    setIframeLoading(root, true);
    preloadIframe.src = buildFrameUrl();
    iframeLoaded = true;
  }

  // Keep inline fallback in sync on resize/orientation changes.
  window.addEventListener("resize", () => {
    applyRootInlineStyle(root);
    const wrap = root.querySelector(`.${IFRAME_WRAP_CLASS}`) as HTMLElement | null;
    const btn = root.querySelector(`.${LAUNCHER_CLASS}`) as HTMLButtonElement | null;
    if (btn) applyLauncherInlineStyle(btn, root);
    if (wrap) applyWrapInlineStyle(wrap);
    if (wrap) wrap.style.pointerEvents = isOpen ? "auto" : "none";
  });

  // Global API
  const api = {
    open: () => setOpen(root, true),
    close: () => setOpen(root, false),
    toggle: () => setOpen(root, !isOpen),
    isOpen: () => isOpen,
  };
  (window as any).Helvion = api;
  (window as any)["Helv" + "ino"] = api;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

