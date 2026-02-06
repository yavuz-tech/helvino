"use client";

import { useState } from "react";
import { useDebug } from "@/contexts/DebugContext";

export default function DebugBanner() {
  const { apiUrl, socketStatus, requests, isMounted } = useDebug();
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
    connected: "Connected",
    disconnected: "Disconnected",
    connecting: "Connecting...",
  }[socketStatus];

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className="bg-slate-800 text-white px-3 py-2 rounded-lg shadow-lg text-xs font-mono hover:bg-slate-700 transition-colors"
        >
          🐛 Debug
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-slate-800 text-white rounded-lg shadow-2xl w-96 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">🐛 Debug Panel</span>
          <span className="text-xs text-slate-400">(DEV only)</span>
        </div>
        <button
          onClick={() => setIsMinimized(true)}
          className="text-slate-400 hover:text-white transition-colors"
        >
          ─
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3 font-mono text-xs">
        {/* API URL */}
        <div>
          <div className="text-slate-400 mb-1">API Base URL:</div>
          <div className="bg-slate-900 px-2 py-1 rounded text-green-400 break-all">
            {apiUrl}
          </div>
        </div>

        {/* Socket Status */}
        <div>
          <div className="text-slate-400 mb-1">Socket.IO Status:</div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${statusColor} animate-pulse`}></div>
            <span className="text-white">{statusText}</span>
          </div>
        </div>

        {/* Recent Requests */}
        <div>
          <div className="text-slate-400 mb-1">Last 5 API Requests:</div>
          {requests.length === 0 ? (
            <div className="text-slate-500 italic">No requests yet</div>
          ) : (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="bg-slate-900 px-2 py-1 rounded text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-blue-400 font-semibold">
                      {req.method}
                    </span>
                    <span className="text-slate-300 flex-1 truncate">
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
                  <div className="text-slate-500 text-[10px] mt-0.5">
                    {req.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-slate-700 text-[10px] text-slate-500 text-center">
        Auto-hides in production builds
      </div>
    </div>
  );
}
