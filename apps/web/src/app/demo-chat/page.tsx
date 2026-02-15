"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n/I18nContext";
import {
  mountPublicWidgetScript,
  resolvePublicWidgetIdentity,
} from "@/lib/public-widget";

/**
 * Demo Chat — Send a message as a customer on this page.
 * Only requires web (3000) + API (4000) running.
 * Messages appear in Portal Inbox (org: demo).
 */
export default function DemoChatPage() {
  const loaded = useRef(false);
  const { t } = useI18n();

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
        <h1 className="text-xl font-bold text-[#1A1D23] mb-2">{t("demoChat.title")}</h1>
        <p className="text-sm text-[#475569] mb-4">
          {t("demoChat.description")}
        </p>
        <Link
          href="/portal/inbox"
          className="inline-block px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm font-medium rounded-lg hover:from-amber-600 hover:to-amber-700"
        >
          {t("demoChat.goToInbox")}
        </Link>
      </div>
    </div>
  );
}
