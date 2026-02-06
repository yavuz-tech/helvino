/**
 * Helvino Widget Embeddable Loader
 * 
 * Usage:
 *   <script>window.HELVINO_ORG_KEY = "demo";</script>
 *   <script src="https://your-cdn.com/embed.js"></script>
 * 
 * API:
 *   Helvino.open()   - Open the widget
 *   Helvino.close()  - Close the widget
 *   Helvino.toggle() - Toggle widget open/close
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
  // Check if orgKey is set
  if (!(window as any).HELVINO_ORG_KEY) {
    console.error(
      "❌ Helvino Widget: HELVINO_ORG_KEY not found on window object.\n" +
      "Please set it before loading the widget:\n" +
      '<script>window.HELVINO_ORG_KEY = "your-org-key";</script>'
    );
    return;
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

  console.log("✅ Helvino Widget initialized");
};

// Global API
const HelvinoAPI = {
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
(window as any).Helvino = HelvinoAPI;

// Auto-initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initWidget);
} else {
  initWidget();
}

// Export for module usage
export default HelvinoAPI;
