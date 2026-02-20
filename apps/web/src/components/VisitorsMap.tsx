"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from "react-simple-maps";

export interface LiveVisitorPoint {
  id: string;
  country: string | null;
  city: string | null;
  lastSeenAt: string;
}

type LatLng = { lat: number; lng: number };

const GEO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

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

function visitorToCoord(v: LiveVisitorPoint): [number, number] {
  const code = String(v.country || "").toUpperCase();
  const c = COUNTRY_CENTER[code] || { lat: 20, lng: 0 };
  return [c.lng, c.lat];
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
  // center: [longitude, latitude] — ZoomableGroup koordinat bekliyor
  const [center, setCenter] = useState<[number, number]>([25, 40]);
  const [zoom, setZoom] = useState(2.2);
  const width = 1200;
  const height = 620;

  const markers = useMemo(
    () =>
      visitors.map((v) => ({
        id: v.id,
        coordinates: visitorToCoord(v),
      })),
    [visitors]
  );

  const handleMoveEnd = useCallback(
    (event: { coordinates: [number, number]; zoom: number }) => {
      setCenter(event.coordinates);
      setZoom(event.zoom);
    },
    []
  );

  const handleZoomIn = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setZoom((z) => Math.min(4, z + 0.5));
  }, []);

  const handleZoomOut = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setZoom((z) => Math.max(1, z - 0.5));
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => e.preventDefault();
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative h-full min-h-[540px] overflow-hidden rounded-r-2xl rounded-l-none bg-[#a8d4f0] touch-none"
      style={{ touchAction: "none" }}
    >
      <style>{`
        @keyframes visitorPulseWhite {
          0% { transform: scale(0.6); opacity: 0.9; }
          70% { transform: scale(2.5); opacity: 0; }
          100% { transform: scale(2.5); opacity: 0; }
        }
      `}</style>

      <ComposableMap
        width={width}
        height={height}
        projection="geoEqualEarth"
        projectionConfig={{
          scale: 140,
          center: [20, 20],
        }}
        style={{ width: "100%", height: "100%" }}
      >
        <ZoomableGroup
          zoom={zoom}
          center={center}
          onMoveEnd={handleMoveEnd}
          minZoom={1}
          maxZoom={5}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }: { geographies: { rsmKey: string; [k: string]: unknown }[] }) =>
              geographies.map((geo: { rsmKey: string; [k: string]: unknown }) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#8fa8c4"
                  stroke="#6b8aad"
                  strokeWidth={0.4}
                  style={{
                    default: { outline: "none" },
                    hover: { outline: "none", fill: "#9ab0cc" },
                    pressed: { outline: "none" },
                  }}
                />
              ))
            }
          </Geographies>
          {markers.map((m) => (
            <Marker key={m.id} coordinates={m.coordinates}>
              <g>
                <circle
                  r={14}
                  fill="rgba(255,255,255,0.5)"
                  style={{
                    animation: "visitorPulseWhite 1.8s ease-out infinite",
                  }}
                />
                <circle r={4} fill="#ffffff" stroke="#e0e0e0" strokeWidth={1} />
              </g>
            </Marker>
          ))}
        </ZoomableGroup>
      </ComposableMap>

      {/* Tooltip - referans: koyu gri kutu, her iki sayı parlak yeşil */}
      <div className="absolute left-6 top-5 rounded-lg bg-[#2a2d33] px-4 py-3 shadow-xl">
        <p className="text-[13px] font-medium text-white">
          <span className="mr-1 font-bold text-[#4ade80]">{onlineCount}</span>
          çevrimiçi kullanıcı
        </p>
        <p className="mt-1 text-[13px] font-medium text-white">
          <span className="mr-1 font-bold text-[#4ade80]">{activeCount}</span>
          aktif kullanıcı
        </p>
        <p className="mt-2 text-[11px] text-[#9ca3af]">
          MagicMap&apos;ten canlı görüntü
        </p>
      </div>

      {/* Zoom controls - referans: koyu gri, beyaz ikonlar */}
      <div className="absolute bottom-5 right-5 flex flex-col overflow-hidden rounded-lg bg-[#2a2d33] shadow-lg">
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center text-white transition hover:bg-white/15"
          onClick={handleZoomIn}
          aria-label="Yakınlaştır"
        >
          +
        </button>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center border-t border-white/15 text-white transition hover:bg-white/15"
          onClick={handleZoomOut}
          aria-label="Uzaklaştır"
        >
          −
        </button>
      </div>

      {/* OpenStreetMap - sol alt */}
      <div className="absolute bottom-2 left-4 text-[10px] text-[#6b7280]">
        © OpenStreetMap
      </div>
    </div>
  );
}
