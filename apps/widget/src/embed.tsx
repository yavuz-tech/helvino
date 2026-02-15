/**
 * Helvion Widget Embeddable Loader
 * 
 * Usage:
 *   <script>window.HELVION_SITE_ID = "your-site-id";</script>
 *   <script src="https://api.helvion.io/embed.js"></script>
 * 
 * Legacy (still supported):
 *   window.HELVINO_SITE_ID / window.HELVINO_ORG_KEY
 * 
 * API:
 *   Helvion.open()   - Open the widget
 *   Helvion.close()  - Close the widget
 *   Helvion.toggle() - Toggle widget open/close
 */

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { getVisitorId } from "./utils/visitor";
import "./index.css";

// Widget state
let isOpen = false;
let root: ReactDOM.Root | null = null;
let rootElement: HTMLElement | null = null;

// Set open state handler
const setOpenState = (open: boolean) => {
  isOpen = open;
  renderWidget();
};

// Render widget
const renderWidget = () => {
  if (!root || !rootElement) return;
  
  root.render(
    <React.StrictMode>
      <App externalIsOpen={isOpen} onOpenChange={setOpenState} />
    </React.StrictMode>
  );
};

// Initialize widget
const initWidget = () => {
  const w = window as any;

  // Normalize: accept HELVION_* (current) or HELVINO_* (legacy)
  // Copy legacy → current so the rest of the code only reads HELVION_*
  if (!w.HELVION_SITE_ID && w.HELVINO_SITE_ID) {
    w.HELVION_SITE_ID = w.HELVINO_SITE_ID;
  }
  if (!w.HELVION_ORG_KEY && w.HELVINO_ORG_KEY) {
    w.HELVION_ORG_KEY = w.HELVINO_ORG_KEY;
  }

  // Check if orgKey or siteId is set
  if (!w.HELVION_ORG_KEY && !w.HELVION_SITE_ID) {
    console.error(
      "❌ Helvion Widget: HELVION_SITE_ID not found on window object.\n" +
      "Please set it before loading the widget:\n" +
      '<script>window.HELVION_SITE_ID = "your-site-id";</script>'
    );
    return;
  }

  // Set parent host for domain allowlist verification (iframe embed scenario)
  try {
    w.HELVION_PARENT_HOST = window.location.hostname;
    // Legacy alias
    w.HELVINO_PARENT_HOST = w.HELVION_PARENT_HOST;
  } catch {
    // cross-origin frame — best-effort
  }

  // Ensure visitor ID exists before initialization
  const visitorId = getVisitorId();
  console.log("🔑 Visitor ID:", visitorId);

  // Create root container if it doesn't exist
  rootElement = document.getElementById("helvino-widget-root");
  if (!rootElement) {
    rootElement = document.createElement("div");
    rootElement.id = "helvino-widget-root";
    document.body.appendChild(rootElement);
  }
  // Mark for easier debugging in DOM
  rootElement.setAttribute("data-helvion-widget-root", "1");

  // Debug mode: show additional UI (e.g. unauthorized-domain warning card)
  if (w.HELVION_DEBUG_WIDGET === true || w.HELVINO_DEBUG_WIDGET === true) {
    document.documentElement.setAttribute("data-helvion-debug-widget", "1");
  }

  // Create React root and render
  root = ReactDOM.createRoot(rootElement);
  renderWidget();

  console.log("✅ Helvion Widget initialized");
};

// Global API
const HelvionAPI = {
  /**
   * Open the widget
   */
  open: () => {
    isOpen = true;
    renderWidget();
  },

  /**
   * Close the widget
   */
  close: () => {
    isOpen = false;
    renderWidget();
  },

  /**
   * Toggle widget open/close
   */
  toggle: () => {
    isOpen = !isOpen;
    renderWidget();
  },

  /**
   * Check if widget is open
   */
  isOpen: () => isOpen,
};

// Expose global API
(window as any).Helvion = HelvionAPI;
(window as any)["Helv" + "ino"] = HelvionAPI;

// Auto-initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initWidget);
} else {
  initWidget();
}

// Export for module usage
export default HelvionAPI;
