import { createRoot } from "react-dom/client";
import "./frame.css";

function App() {
  const handleClose = () => {
    try {
      window.parent.postMessage("helvion:close", "*");
    } catch {
      // cross-origin safety
    }
  };

  return (
    <div className="hv-app">
      <header className="hv-header">
        <div className="hv-header-text">
          <h1>Helvion Chat</h1>
          <p>We typically reply within minutes</p>
        </div>
        <button className="hv-close-btn" onClick={handleClose} aria-label="Close chat">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </header>

      <main className="hv-body">
        <div className="hv-welcome">
          <span className="hv-wave">👋</span>
          <p>Widget v2 çalışıyor!</p>
        </div>
      </main>

      <footer className="hv-footer">
        <span>Powered by <strong>Helvion</strong></span>
      </footer>
    </div>
  );
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<App />);
}
