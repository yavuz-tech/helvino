"use client";

import { useState } from "react";
import { useDebug } from "@/contexts/DebugContext";
import { useI18n } from "@/i18n/I18nContext";

export default function DebugBanner() {
  const { apiUrl, socketStatus, requests, isMounted } = useDebug();
  const { t } = useI18n();
  const [isMinimized, setIsMinimized] = useState(false);

  // Only render on client-side in development
  if (!isMounted || process.env.NODE_ENV !== "development") {
    return null;
  }

  const statusColor = {
    connected: "bg-green-500",
    disconnected: "bg-red-500",
    connecting: "bg-yellow-500",
  }[socketStatus];

  const statusText = {
    connected: t("debug.connected"),
    disconnected: t("debug.disconnected"),
    connecting: t("debug.connecting"),
  }[socketStatus];

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className="bg-[#1E293B] text-white px-3 py-2 rounded-lg shadow-lg text-xs font-mono hover:bg-[#334155] transition-colors"
        >
          🐛 {t("debug.panel")}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-[#1E293B] text-white rounded-lg shadow-2xl w-96 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#334155]">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">🐛 {t("debug.panel")}</span>
          <span className="text-xs text-[#94A3B8]">({t("debug.devOnly")})</span>
        </div>
        <button
          onClick={() => setIsMinimized(true)}
          className="text-[#94A3B8] hover:text-white transition-colors"
        >
          ─
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3 font-mono text-xs">
        {/* API URL */}
        <div>
          <div className="text-[#94A3B8] mb-1">{t("debug.apiUrl")}:</div>
          <div className="bg-[#0F172A] px-2 py-1 rounded text-green-400 break-all">
            {apiUrl}
          </div>
        </div>

        {/* Socket Status */}
        <div>
          <div className="text-[#94A3B8] mb-1">{t("debug.socketStatus")}:</div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${statusColor} animate-pulse`}></div>
            <span className="text-white">{statusText}</span>
          </div>
        </div>

        {/* Recent Requests */}
        <div>
          <div className="text-[#94A3B8] mb-1">{t("debug.lastRequests")}:</div>
          {requests.length === 0 ? (
            <div className="text-[#64748B] italic">{t("debug.noRequests")}</div>
          ) : (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="bg-[#0F172A] px-2 py-1 rounded text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-amber-400 font-semibold">
                      {req.method}
                    </span>
                    <span className="text-[#CBD5E1] flex-1 truncate">
                      {req.path}
                    </span>
                    <span
                      className={`${
                        req.status && req.status >= 200 && req.status < 300
                          ? "text-green-400"
                          : req.status && req.status >= 400
                          ? "text-red-400"
                          : "text-yellow-400"
                      } font-semibold`}
                    >
                      {req.status || "..."}
                    </span>
                  </div>
                  <div className="text-[#64748B] text-[10px] mt-0.5">
                    {req.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-[#334155] text-[10px] text-[#64748B] text-center">
        {t("debug.autoHides")}
      </div>
    </div>
  );
}
