/**
 * Helvion Widget UI (IFRAME)
 *
 * This bundle runs inside https://api.helvion.io/widget-frame.html.
 * It renders the full chat UI, isolated from customer site CSS.
 */

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./frame.css";

function installVisualViewportFix() {
  // iOS Safari keyboard shrinks the visual viewport but does not always
  // reflow fixed/100vh layouts inside iframes. Force document height to match.
  const vv = window.visualViewport;
  if (!vv) return;

  let raf = 0;
  const apply = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const h = Math.round(vv.height);
      const heightPx = `${h}px`;
      document.documentElement.style.height = heightPx;
      document.body.style.height = heightPx;
      // Expose to CSS so .chat-window can use var(--app-height).
      document.documentElement.style.setProperty("--app-height", heightPx);
      // Keep the input bar visible (avoid the document being scrollable under keyboard).
      try {
        window.scrollTo(0, 0);
      } catch {}
    });
  };

  vv.addEventListener("resize", apply);
  vv.addEventListener("scroll", () => {
    try {
      window.scrollTo(0, 0);
    } catch {}
  });

  apply();
}

function applyFrameConfigFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const siteId = params.get("siteId") || "";
  const orgKey = params.get("orgKey") || "";
  const parentHost = params.get("parentHost") || "";

  const w = window as any;
  if (siteId) w.HELVION_SITE_ID = siteId;
  if (orgKey) w.HELVION_ORG_KEY = orgKey;
  if (parentHost) {
    // Bootloader/domain allowlist must validate against the CUSTOMER host,
    // not api.helvion.io (iframe origin).
    w.HELVION_PARENT_HOST = parentHost;
    w.HELVINO_PARENT_HOST = parentHost;
  }
}

applyFrameConfigFromUrl();
installVisualViewportFix();

const rootEl = document.getElementById("helvion-frame-root");
if (!rootEl) {
  const el = document.createElement("div");
  el.id = "helvion-frame-root";
  document.body.appendChild(el);
}

const mountEl = document.getElementById("helvion-frame-root")!;
ReactDOM.createRoot(mountEl).render(
  <React.StrictMode>
    <App
      mode="frame"
      externalIsOpen={true}
      onRequestClose={() => {
        try {
          window.parent?.postMessage({ type: "helvion:close" }, "*");
        } catch {}
      }}
    />
  </React.StrictMode>
);

