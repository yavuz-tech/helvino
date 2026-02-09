"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

/**
 * Demo Chat — Müşteri gibi mesaj göndermek için tek sayfa.
 * Sadece web (3000) + API (4000) çalışsın yeter.
 * Bu sayfadan mesaj gönder → Portal Inbox'ta görünür (org: demo).
 */
export default function DemoChatPage() {
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;

    (window as unknown as { HELVINO_ORG_KEY?: string }).HELVINO_ORG_KEY = "demo";

    const script = document.createElement("script");
    script.src = "/embed.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-slate-200 p-6">
        <h1 className="text-xl font-bold text-slate-900 mb-2">Sohbet widget testi</h1>
        <p className="text-sm text-slate-600 mb-4">
          Sağ alttaki sohbet balonuna tıklayın, mesaj yazıp gönderin. Mesajınız müşteri portalındaki Inbox’ta görünecek.
        </p>
        <Link
          href="/portal/inbox"
          className="inline-block px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700"
        >
          Portal Inbox’a git →
        </Link>
      </div>
    </div>
  );
}
