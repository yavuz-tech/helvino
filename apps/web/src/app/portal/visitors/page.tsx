"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, User } from "lucide-react";
import { portalApiFetch } from "@/lib/portal-auth";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import VisitorsMap, { type LiveVisitorPoint } from "@/components/VisitorsMap";

interface LiveVisitor extends LiveVisitorPoint {
  visitorKey: string;
  ip: string | null;
  browser: string;
  os: string;
  device: string;
  currentPage: string | null;
  referrer: string | null;
  firstSeenAt: string;
  conversationCount: number;
}

interface VisitorsData {
  live: LiveVisitor[];
  recent: LiveVisitor[];
  counts: { live: number; today: number; total: number };
}

function dedupeVisitors(input: LiveVisitor[]) {
  const byKey = new Map<string, LiveVisitor>();
  for (const v of input) {
    const key = v.visitorKey || v.id;
    const prev = byKey.get(key);
    if (!prev || new Date(v.lastSeenAt).getTime() > new Date(prev.lastSeenAt).getTime()) {
      byKey.set(key, v);
    }
  }
  return Array.from(byKey.values());
}

export default function PortalVisitorsPage() {
  const { user, loading } = usePortalAuth();
  const [data, setData] = useState<VisitorsData | null>(null);
  const [query, setQuery] = useState("");
  const [chatLoadingId, setChatLoadingId] = useState<string | null>(null);

  const fetchVisitors = useCallback(async () => {
    try {
      const res = await portalApiFetch(`/portal/dashboard/visitors?_t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as VisitorsData;
      setData(json);
    } catch {
      // keep previous state
    }
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    fetchVisitors();
    const timer = window.setInterval(fetchVisitors, 30_000);
    return () => window.clearInterval(timer);
  }, [loading, user, fetchVisitors]);

  const allVisitors = useMemo(() => {
    const live = data?.live || [];
    const recent = data?.recent || [];
    return dedupeVisitors([...live, ...recent]);
  }, [data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allVisitors;
    return allVisitors.filter((v) => {
      const name = `${v.city || ""} ${v.country || ""}`.toLowerCase();
      return name.includes(q);
    });
  }, [allVisitors, query]);

  const activeCount = useMemo(() => {
    const now = Date.now();
    return (data?.live || []).filter((v) => now - new Date(v.lastSeenAt).getTime() <= 2 * 60_000).length;
  }, [data]);

  const handleStartChat = useCallback(async (visitorId: string) => {
    setChatLoadingId(visitorId);
    try {
      const res = await portalApiFetch(`/portal/dashboard/visitors/${visitorId}/chat`, { method: "POST" });
      if (res.ok) {
        const d = await res.json();
        const cid = d?.conversationId;
        if (cid) window.location.href = `/portal/inbox?c=${encodeURIComponent(cid)}`;
      }
    } catch {
      // no-op
    } finally {
      setChatLoadingId(null);
    }
  }, []);

  return (
    <div className="h-[calc(100vh-126px)] min-h-[620px] overflow-hidden rounded-2xl border border-[#d6deec] bg-white">
      <div className="grid h-full grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Sol panel - PNG referansı: turuncu avatar, kırmızı C badge, visitor151 / Hugo */}
        <section className="flex h-full min-h-0 flex-col border-r border-[#e5e7eb] bg-[#fafafa]">
          <div className="flex items-center justify-between border-b border-[#e5e7eb] px-4 py-3">
            <h1 className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#374151]">
              ZİYARETÇİLER
            </h1>
            <span className="rounded-md bg-[#f4b648] px-2.5 py-1 text-[10px] font-bold text-white">
              Canlı
            </span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {filtered.map((v) => {
              const title = v.visitorKey || v.city || v.country || "Visitor";
              const displayTitle = title.length > 12 ? title.slice(0, 12) : title;
              const subtitle = v.city || v.country || v.browser || "—";
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => handleStartChat(v.id)}
                  className="group flex w-full items-center gap-3 border-b border-[#e5e7eb] px-4 py-3.5 text-left transition hover:bg-white"
                >
                  {/* Avatar: açık turuncu arka plan, koyu turuncu kişi ikonu, kırmızı C badge */}
                  <div className="relative shrink-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fde8d4]">
                      <User size={18} className="text-[#c2410c]" strokeWidth={2.5} />
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-[#dc2626] text-[9px] font-bold text-white">
                      C
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-[#1f2937]">{displayTitle}</p>
                    <p className="truncate text-[12px] text-[#6b7280]">{subtitle}</p>
                  </div>
                  {chatLoadingId === v.id ? (
                    <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[#9ca3af] border-t-[#3b82f6]" />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="border-t border-[#e5e7eb] p-3">
            <label className="relative block">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ada, şehre göre filtrele..."
                className="w-full rounded-lg border border-[#d1d5db] bg-white py-2.5 pl-9 pr-3 text-[12px] text-[#374151] placeholder:text-[#9ca3af] outline-none transition focus:border-[#7ea8ea] focus:ring-1 focus:ring-[#7ea8ea]"
              />
            </label>
          </div>
        </section>

        <section className="h-full min-h-0">
          <VisitorsMap
            visitors={filtered}
            onlineCount={data?.counts.live ?? 0}
            activeCount={activeCount}
          />
        </section>
      </div>
    </div>
  );
}

