import "./loader.css";

const FRAME_ORIGIN = "https://api.helvion.io";
const Z_TOP = 2147483647;

function ensureEmbedCssLoaded(): void {
  try {
    if (document.querySelector('link[data-helvion-widget-css="1"]')) return;

    // Try to preserve ?v= cache-busting from the script URL.
    let v = "";
    try {
      const cs = document.currentScript as HTMLScriptElement | null;
      const src = cs?.src || "";
      if (src) {
        const u = new URL(src);
        v = u.searchParams.get("v") || "";
      }
    } catch {
      // ignore
    }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `${FRAME_ORIGIN}/embed.css${v ? `?v=${encodeURIComponent(v)}` : ""}`;
    link.setAttribute("data-helvion-widget-css", "1");
    document.head.appendChild(link);
  } catch {
    // non-fatal
  }
}

function getSiteId(): string {
  const w = window as unknown as Record<string, unknown>;
  if (typeof w.HELVION_SITE_ID === "string" && w.HELVION_SITE_ID) {
    return w.HELVION_SITE_ID;
  }
  const script = document.querySelector<HTMLScriptElement>("script[data-site]");
  if (script) return script.dataset.site || "";
  return "";
}

function isMobile(): boolean {
  return window.innerWidth <= 768;
}

let isOpen = false;
let container: HTMLDivElement | null = null;
let launcher: HTMLDivElement | null = null;
let savedScrollY = 0;

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

  if (isOpen) {
    container.style.display = "block";
    // Trigger reflow before adding class for animation
    void container.offsetHeight;
    container.classList.add("helvion-open");
    launcher.classList.add("helvion-launcher--active");
    if (isMobile()) lockBody();
  } else {
    container.classList.remove("helvion-open");
    launcher.classList.remove("helvion-launcher--active");
    if (isMobile()) unlockBody();
    // Hide after animation ends
    setTimeout(() => {
      if (!isOpen && container) container.style.display = "none";
    }, 300);
  }
}

function onFrameMessage(e: MessageEvent): void {
  if (e.origin !== FRAME_ORIGIN && e.origin !== window.location.origin) return;
  if (e.data === "helvion:close") {
    if (isOpen) toggle();
  }
}

function createLauncher(): HTMLDivElement {
  const el = document.createElement("div");
  el.id = "helvion-launcher";
  el.setAttribute("role", "button");
  el.setAttribute("aria-label", "Open chat");
  el.setAttribute("tabindex", "0");
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><svg class="helvion-close-icon" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  el.style.zIndex = String(Z_TOP);
  el.addEventListener("click", toggle);
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
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
  try {
    parentHost = window.location.host || window.location.hostname || "";
  } catch {
    // ignore
  }
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
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
