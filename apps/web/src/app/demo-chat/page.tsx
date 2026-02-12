"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import {
  mountPublicWidgetScript,
  resolvePublicWidgetIdentity,
} from "@/lib/public-widget";

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
    (window as unknown as { HELVINO_WIDGET_FORCE_LEFT?: boolean }).HELVINO_WIDGET_FORCE_LEFT = false;
    const identity = resolvePublicWidgetIdentity();
    mountPublicWidgetScript(identity);
  }, []);

  return (
    <div className="min-h-screen bg-[#FFFBF5] flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-[#F3E8D8] p-6">
        <h1 className="text-xl font-bold text-[#1A1D23] mb-2">Sohbet widget testi</h1>
        <p className="text-sm text-[#475569] mb-4">
          Sağ alttaki sohbet balonuna tıklayın, mesaj yazıp gönderin. Mesajınız müşteri portalındaki Inbox’ta görünecek.
        </p>
        <Link
          href="/portal/inbox"
          className="inline-block px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm font-medium rounded-lg hover:from-amber-600 hover:to-amber-700"
        >
          Portal Inbox’a git →
        </Link>
      </div>
    </div>
  );
}
