"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { portalApiFetch } from "@/lib/portal-auth";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import VisitorsMap, { type LiveVisitorPoint } from "@/components/VisitorsMap";
import { colors, fonts } from "@/lib/design-tokens";

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
  void fonts;
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
        <section className="flex h-full min-h-0 flex-col border-r border-[#e7ebf3] bg-[#f7f8fa]">
          <div className="flex items-center justify-between border-b border-[#e7ebf3] px-4 py-3">
            <h1 className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-[#2f3d52]">
              ZİYARETÇİLER
            </h1>
            <span className="rounded-md bg-[#f4b648] px-2 py-0.5 text-[10px] font-bold text-white">
              Canlı
            </span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {filtered.map((v) => {
              const title = v.city || v.country || "Visitor";
              const subtitle = `Helvion Bot · ${v.browser}`;
              const initial = title.slice(0, 1).toUpperCase() || "V";
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => handleStartChat(v.id)}
                  className="group flex w-full items-center gap-3 border-b border-[#edf1f7] px-4 py-3 text-left transition hover:bg-white"
                >
                  <div className="relative">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f1f3f8] text-sm font-bold text-[#425268]">
                      {initial}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-white bg-[#ef4444]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-[#2a3342]">{title}</p>
                    <p className="truncate text-[11px] text-[#8a95a7]">{subtitle}</p>
                  </div>
                  {chatLoadingId === v.id ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#9ab2d6] border-t-[#3b82f6]" />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="border-t border-[#e7ebf3] p-3">
            <label className="relative block">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa5b5]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ada, şehre göre filtrele..."
                className="w-full rounded-md border border-[#d9e1ef] bg-white py-2 pl-9 pr-3 text-[12px] text-[#344154] outline-none transition focus:border-[#7ea8ea]"
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

      <div className="hidden" style={{ color: colors.neutral[500] }} />
    </div>
  );
}

