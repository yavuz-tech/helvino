"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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

function visitorToLatLng(v: LiveVisitorPoint): [number, number] {
  const code = normalizeCountryToIso2(v.country);
  const c = COUNTRY_CENTER[code] || { lat: 20, lng: 0 };
  return [c.lat, c.lng];
}

function countryToFlag(country: string | null): string {
  const iso2 = normalizeCountryToIso2(country);
  if (!/^[A-Z]{2}$/.test(iso2)) return "";
  const base = 127397;
  return String.fromCodePoint(...[...iso2].map((c) => c.charCodeAt(0) + base));
}

function makePulseIcon(flag: string): L.DivIcon {
  return L.divIcon({
    className: "",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    html: `
      <div style="position:relative;width:32px;height:32px;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;width:28px;height:28px;border-radius:50%;background:rgba(74,222,128,0.35);animation:leafletPulse 1.6s ease-out infinite;"></div>
        <div style="width:12px;height:12px;border-radius:50%;background:#4ade80;border:2px solid #fff;box-shadow:0 0 6px rgba(74,222,128,0.6);z-index:2;"></div>
        ${flag ? `<span style="position:absolute;top:-14px;left:50%;transform:translateX(-50%);font-size:16px;line-height:1;pointer-events:none;user-select:none;">${flag}</span>` : ""}
      </div>
    `,
  });
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
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  const points = useMemo(
    () =>
      visitors.map((v) => ({
        id: v.id,
        latlng: visitorToLatLng(v),
        flag: countryToFlag(v.country),
        city: v.city,
        country: v.country,
      })),
    [visitors]
  );

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [30, 20],
      zoom: 3,
      minZoom: 2,
      maxZoom: 10,
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: true,
      dragging: true,
      doubleClickZoom: true,
      touchZoom: true,
    });

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      { subdomains: "abcd", maxZoom: 19 }
    ).addTo(map);

    L.control.attribution({ position: "bottomleft", prefix: false })
      .addAttribution("© OpenStreetMap")
      .addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    for (const p of points) {
      const icon = makePulseIcon(p.flag);
      const marker = L.marker(p.latlng, { icon }).addTo(map);
      const label = [p.city, p.country].filter(Boolean).join(", ");
      if (label) marker.bindTooltip(label, { direction: "top", offset: [0, -18] });
      markersRef.current.push(marker);
    }

    if (points.length > 0) {
      const bounds = L.latLngBounds(points.map((p) => p.latlng));
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 5 });
    }
  }, [points]);

  return (
    <div className="relative h-full min-h-[540px] overflow-hidden rounded-r-2xl rounded-l-none">
      <style>{`
        @keyframes leafletPulse {
          0% { transform: scale(0.5); opacity: 0.9; }
          70% { transform: scale(2.2); opacity: 0; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        .leaflet-container { width: 100%; height: 100%; background: #b3d1f0; font-family: inherit; }
        .leaflet-control-zoom a { background: #2a2d33 !important; color: #fff !important; border-color: rgba(255,255,255,0.15) !important; }
        .leaflet-control-zoom a:hover { background: #3a3d43 !important; }
        .leaflet-control-attribution {
          background: rgba(17, 24, 39, 0.45) !important;
          color: rgba(255, 255, 255, 0.75) !important;
          border-radius: 8px !important;
          margin: 8px !important;
          padding: 2px 6px !important;
          backdrop-filter: blur(4px);
          font-size: 10px !important;
          line-height: 1.2 !important;
        }
        .leaflet-control-attribution a {
          color: rgba(255, 255, 255, 0.85) !important;
          text-decoration: none !important;
        }
      `}</style>

      <div ref={mapContainerRef} className="h-full w-full" />

      <div className="pointer-events-none absolute left-5 top-4 z-[1000] rounded-lg bg-[#2a2d33]/90 px-4 py-3 shadow-xl backdrop-blur-sm">
        <p className="text-[13px] font-medium text-white">
          <span className="mr-1 font-bold text-[#4ade80]">{onlineCount}</span>
          çevrimiçi kullanıcı
        </p>
        <p className="mt-1 text-[13px] font-medium text-white">
          <span className="mr-1 font-bold text-[#4ade80]">{activeCount}</span>
          aktif kullanıcı
        </p>
        <p className="mt-2 text-[11px] text-[#9ca3af]">
          Canli ziyaretci islem haritasi
        </p>
      </div>
    </div>
  );
}
