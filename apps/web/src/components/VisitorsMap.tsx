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
  MX: { lat: 23.6, lng: -102.5 },
  AR: { lat: -38.4, lng: -63.6 },
  CL: { lat: -35.7, lng: -71.5 },
  CO: { lat: 4.6, lng: -74.1 },
  PE: { lat: -9.2, lng: -75.0 },
  ZA: { lat: -30.6, lng: 22.9 },
  NG: { lat: 9.1, lng: 8.7 },
  KE: { lat: -0.02, lng: 37.9 },
  MA: { lat: 31.8, lng: -7.1 },
  DZ: { lat: 28.0, lng: 1.7 },
  TN: { lat: 33.9, lng: 9.5 },
  PK: { lat: 30.4, lng: 69.4 },
  BD: { lat: 23.7, lng: 90.4 },
  TH: { lat: 15.8, lng: 101.0 },
  VN: { lat: 14.1, lng: 108.3 },
  ID: { lat: -2.2, lng: 117.3 },
  KR: { lat: 36.3, lng: 127.8 },
  UA: { lat: 49.0, lng: 31.4 },
  PL: { lat: 52.1, lng: 19.1 },
  SE: { lat: 60.1, lng: 18.6 },
  NO: { lat: 60.5, lng: 8.5 },
  FI: { lat: 64.5, lng: 26.0 },
  GR: { lat: 39.1, lng: 21.8 },
  RO: { lat: 45.9, lng: 24.9 },
  BG: { lat: 42.7, lng: 25.5 },
  IL: { lat: 31.0, lng: 35.0 },
  IQ: { lat: 33.2, lng: 43.7 },
  IR: { lat: 32.4, lng: 53.7 },
};

const COUNTRY_ALIASES: Record<string, string> = {
  TURKEY: "TR", TURKIYE: "TR", "TURKIYE CUMHURIYETI": "TR",
  "UNITED STATES": "US", USA: "US",
  "UNITED KINGDOM": "GB", UK: "GB",
  GERMANY: "DE", FRANCE: "FR", SPAIN: "ES", ITALY: "IT", NETHERLANDS: "NL",
  RUSSIA: "RU", INDIA: "IN", BRAZIL: "BR", CANADA: "CA", AUSTRALIA: "AU",
  JAPAN: "JP", CHINA: "CN", "SAUDI ARABIA": "SA", "UNITED ARAB EMIRATES": "AE",
  EGYPT: "EG", MEXICO: "MX", ARGENTINA: "AR", CHILE: "CL", COLOMBIA: "CO",
  PERU: "PE", "SOUTH AFRICA": "ZA", NIGERIA: "NG", KENYA: "KE",
  MOROCCO: "MA", ALGERIA: "DZ", TUNISIA: "TN", PAKISTAN: "PK",
  BANGLADESH: "BD", THAILAND: "TH", VIETNAM: "VN", INDONESIA: "ID",
  "SOUTH KOREA": "KR", UKRAINE: "UA", POLAND: "PL", SWEDEN: "SE",
  NORWAY: "NO", FINLAND: "FI", GREECE: "GR", ROMANIA: "RO", BULGARIA: "BG",
  ISRAEL: "IL", IRAQ: "IQ", IRAN: "IR",
};

function normalizeCountryToIso2(raw: string | null): string {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (/^[A-Za-z]{2}$/.test(value)) return value.toUpperCase();
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  return COUNTRY_ALIASES[normalized] || "";
}

function visitorToCoord(v: LiveVisitorPoint): [number, number] {
  const code = normalizeCountryToIso2(v.country);
  const c = COUNTRY_CENTER[code] || { lat: 20, lng: 0 };
  return [c.lng, c.lat];
}

function countryToFlagEmoji(country: string | null): string | null {
  const iso2 = normalizeCountryToIso2(country);
  if (!/^[A-Z]{2}$/.test(iso2)) return null;
  const base = 127397;
  return String.fromCodePoint(...[...iso2].map((c) => c.charCodeAt(0) + base));
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
  const width = 960;
  const height = 500;

  const [position, setPosition] = useState({ coordinates: [20, 30] as [number, number], zoom: 1.6 });

  const markers = useMemo(
    () =>
      visitors.map((v) => ({
        id: v.id,
        coordinates: visitorToCoord(v),
        flag: countryToFlagEmoji(v.country),
      })),
    [visitors]
  );

  const handleMoveEnd = useCallback(
    (pos: { coordinates: [number, number]; zoom: number }) => {
      setPosition(pos);
    },
    []
  );

  const handleZoomIn = useCallback(() => {
    setPosition((p) => ({ ...p, zoom: Math.min(6, p.zoom * 1.35) }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setPosition((p) => ({ ...p, zoom: Math.max(1, p.zoom / 1.35) }));
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const direction = e.deltaY < 0 ? 1 : -1;
      setPosition((p) => {
        const factor = 1 + direction * 0.12;
        return { ...p, zoom: Math.max(1, Math.min(6, p.zoom * factor)) };
      });
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative h-full min-h-[540px] overflow-hidden rounded-r-2xl rounded-l-none bg-[#a8d4f0]"
      style={{ touchAction: "none" }}
    >
      <style>{`
        @keyframes visitorPulseWhite {
          0% { transform: scale(0.6); opacity: 0.9; }
          70% { transform: scale(2.5); opacity: 0; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        .rsm-svg { display: block; width: 100%; height: 100%; }
      `}</style>

      <ComposableMap
        width={width}
        height={height}
        projection="geoMercator"
        projectionConfig={{
          scale: 130,
          center: [0, 20],
        }}
        style={{ width: "100%", height: "100%" }}
      >
        <ZoomableGroup
          center={position.coordinates}
          zoom={position.zoom}
          onMoveEnd={handleMoveEnd}
          minZoom={1}
          maxZoom={6}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }: { geographies: { rsmKey: string; [k: string]: unknown }[] }) =>
              geographies.map((geo: { rsmKey: string; [k: string]: unknown }) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#8fa8c4"
                  stroke="#7a99b8"
                  strokeWidth={0.3}
                  style={{
                    default: { outline: "none" },
                    hover: { outline: "none", fill: "#9ab3cc" },
                    pressed: { outline: "none" },
                  }}
                />
              ))
            }
          </Geographies>
          {markers.map((m) => (
            <Marker key={m.id} coordinates={m.coordinates}>
              <g>
                {m.flag ? (
                  <text
                    x={0}
                    y={-14}
                    textAnchor="middle"
                    style={{ fontSize: 14, userSelect: "none", pointerEvents: "none" }}
                  >
                    {m.flag}
                  </text>
                ) : null}
                <circle
                  r={12}
                  fill="rgba(255,255,255,0.45)"
                  style={{ animation: "visitorPulseWhite 1.8s ease-out infinite" }}
                />
                <circle r={4.5} fill="#ffffff" stroke="#d0d0d0" strokeWidth={1.2} />
              </g>
            </Marker>
          ))}
        </ZoomableGroup>
      </ComposableMap>

      {/* Stats tooltip */}
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

      {/* Zoom controls */}
      <div className="absolute bottom-5 right-5 flex flex-col overflow-hidden rounded-lg bg-[#2a2d33] shadow-lg">
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center text-[18px] font-bold text-white transition hover:bg-white/15 active:bg-white/25"
          onClick={handleZoomIn}
          aria-label="Yakınlaştır"
        >
          +
        </button>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center border-t border-white/15 text-[18px] font-bold text-white transition hover:bg-white/15 active:bg-white/25"
          onClick={handleZoomOut}
          aria-label="Uzaklaştır"
        >
          −
        </button>
      </div>

      {/* Attribution */}
      <div className="absolute bottom-2 left-4 text-[10px] text-[#6b7280]">
        © OpenStreetMap
      </div>
    </div>
  );
}
