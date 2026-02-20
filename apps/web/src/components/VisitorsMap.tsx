"use client";

import { useMemo, useState } from "react";
import { colors } from "@/lib/design-tokens";

export interface LiveVisitorPoint {
  id: string;
  country: string | null;
  city: string | null;
  lastSeenAt: string;
}

type LatLng = { lat: number; lng: number };

const COUNTRY_CENTER: Record<string, LatLng> = {
  TR: { lat: 39.0, lng: 35.0 },
  US: { lat: 39.8, lng: -98.6 },
  GB: { lat: 55.0, lng: -3.4 },
  DE: { lat: 51.1, lng: 10.4 },
  FR: { lat: 46.2, lng: 2.2 },
  ES: { lat: 40.3, lng: -3.7 },
  IT: { lat: 41.9, lng: 12.6 },
  NL: { lat: 52.1, lng: 5.3 },
  RU: { lat: 61.5, lng: 105.3 },
  IN: { lat: 20.6, lng: 78.9 },
  BR: { lat: -14.2, lng: -51.9 },
  CA: { lat: 56.1, lng: -106.3 },
  AU: { lat: -25.3, lng: 133.8 },
  JP: { lat: 36.2, lng: 138.2 },
  CN: { lat: 35.8, lng: 104.2 },
  SA: { lat: 23.9, lng: 45.1 },
  AE: { lat: 24.4, lng: 54.4 },
  EG: { lat: 26.8, lng: 30.8 },
};

function toMapPoint(lat: number, lng: number, width: number, height: number) {
  const x = ((lng + 180) / 360) * width;
  const y = ((90 - lat) / 180) * height;
  return { x, y };
}

function visitorToCoord(v: LiveVisitorPoint): LatLng {
  const code = String(v.country || "").toUpperCase();
  return COUNTRY_CENTER[code] || { lat: 20, lng: 0 };
}

export default function VisitorsMap({
  visitors,
  onlineCount,
  activeCount,
}: {
  visitors: LiveVisitorPoint[];
  onlineCount: number;
  activeCount: number;
}) {
  const [zoom, setZoom] = useState(1);
  const width = 1200;
  const height = 620;

  const points = useMemo(
    () =>
      visitors.map((v) => {
        const { lat, lng } = visitorToCoord(v);
        const { x, y } = toMapPoint(lat, lng, width, height);
        return { id: v.id, x, y };
      }),
    [visitors]
  );

  return (
    <div className="relative h-full min-h-[540px] overflow-hidden rounded-r-2xl rounded-l-none border border-[#2f69b6] bg-[#5f8fd4]">
      <style jsx>{`
        @keyframes visitorPulse {
          0% { transform: scale(0.85); opacity: 0.85; }
          70% { transform: scale(2.1); opacity: 0; }
          100% { transform: scale(2.1); opacity: 0; }
        }
      `}</style>

      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(140% 100% at 20% 10%, rgba(142,182,239,0.42) 0%, rgba(95,143,212,0.96) 55%, rgba(73,123,194,1) 100%)",
        }}
      />

      <div className="absolute inset-0 opacity-40">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" preserveAspectRatio="none">
          <g
            transform={`translate(${width / 2}px, ${height / 2}px) scale(${zoom}) translate(${-width / 2}px, ${-height / 2}px)`}
            style={{ transformOrigin: "center center" }}
          >
            <path d="M89 168L123 146L170 142L224 154L260 180L289 209L324 227L330 252L307 268L258 261L232 247L191 237L149 228L125 202L96 195L82 177Z" fill="#7ca6df" fillOpacity="0.55" />
            <path d="M319 256L362 271L385 304L398 334L407 369L420 403L443 430L434 455L402 462L370 444L342 412L326 373L309 333L298 297Z" fill="#7ca6df" fillOpacity="0.52" />
            <path d="M559 168L590 160L635 167L678 179L715 200L753 216L796 242L825 278L818 303L779 301L735 291L705 277L678 252L650 238L611 225L584 205L563 184Z" fill="#7ca6df" fillOpacity="0.56" />
            <path d="M606 315L642 303L684 304L721 324L744 358L742 385L710 398L681 393L650 401L623 434L594 450L569 444L551 418L560 381L579 351Z" fill="#7ca6df" fillOpacity="0.53" />
            <path d="M811 360L844 351L882 359L924 382L949 411L960 439L953 472L930 497L902 508L875 492L856 468L840 433L821 401Z" fill="#7ca6df" fillOpacity="0.55" />
            <path d="M990 527L1022 533L1047 552L1038 572L1004 578L986 559Z" fill="#7ca6df" fillOpacity="0.52" />
          </g>
        </svg>
      </div>

      <div className="absolute left-8 top-6 rounded-lg bg-[#2a3e5a]/88 px-4 py-3 text-white shadow-2xl">
        <p className="text-[14px] font-semibold">
          <span className="mr-1 text-[#7cff63]">{onlineCount}</span>
          çevrimiçi kullanıcı
        </p>
        <p className="mt-1 text-[14px] font-semibold">
          <span className="mr-1 text-[#61a9ff]">{activeCount}</span>
          aktif kullanıcı
        </p>
        <p className="mt-2 text-[11px] text-white/65">MagicMap&apos;ten canlı görüntü</p>
      </div>

      <div className="absolute inset-0">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" preserveAspectRatio="none">
          <g
            transform={`translate(${width / 2}px, ${height / 2}px) scale(${zoom}) translate(${-width / 2}px, ${-height / 2}px)`}
            style={{ transformOrigin: "center center" }}
          >
            {points.map((p) => (
              <g key={p.id} transform={`translate(${p.x} ${p.y})`}>
                <circle r="16" fill="rgba(20, 255, 120, 0.26)" style={{ animation: "visitorPulse 1.6s infinite" }} />
                <circle r="5.5" fill="#30e96f" stroke="#d5ffe4" strokeWidth="2" />
              </g>
            ))}
          </g>
        </svg>
      </div>

      <div className="absolute bottom-5 right-5 flex flex-col overflow-hidden rounded-lg border border-white/30 bg-[#2a3e5a]/90 text-white">
        <button
          type="button"
          className="h-8 w-8 text-[18px] leading-none transition hover:bg-white/15"
          onClick={() => setZoom((z) => Math.min(2.2, Number((z + 0.2).toFixed(2))))}
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          className="h-8 w-8 border-t border-white/20 text-[18px] leading-none transition hover:bg-white/15"
          onClick={() => setZoom((z) => Math.max(1, Number((z - 0.2).toFixed(2))))}
          aria-label="Zoom out"
        >
          -
        </button>
      </div>

      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-white/70">
        © OpenStreetMap
      </div>

      <div className="pointer-events-none absolute inset-0 rounded-r-2xl rounded-l-none ring-1 ring-inset ring-white/10" />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-px bg-white/10" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#4f7fc7]/25 to-transparent" />
      <div className="pointer-events-none absolute inset-0 opacity-5" style={{ background: colors.neutral.white }} />
    </div>
  );
}

