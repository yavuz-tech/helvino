/**
 * Helvion Widget Embeddable Loader
 * 
 * Usage:
 *   <script>window.HELVINO_ORG_KEY = "demo";</script>
 *   <script src="https://your-cdn.com/embed.js"></script>
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
  // Check if orgKey or siteId is set
  if (!(window as any).HELVINO_ORG_KEY && !(window as any).HELVINO_SITE_ID) {
    console.error(
      "❌ Helvion Widget: HELVINO_SITE_ID or HELVINO_ORG_KEY not found on window object.\n" +
      "Please set it before loading the widget:\n" +
      '<script>window.HELVINO_SITE_ID = "your-site-id";</script>'
    );
    return;
  }

  // Set parent host for domain allowlist verification (iframe embed scenario)
  try {
    (window as any).HELVINO_PARENT_HOST = window.location.hostname;
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
