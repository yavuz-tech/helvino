"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles, Ticket } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { portalApiFetch } from "@/lib/portal-auth";
import { orgApiFetch } from "@/lib/org-auth";
import { apiFetch } from "@/utils/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type CampaignPayload = {
  id: string;
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  bannerTitle: string | null;
  bannerSubtitle: string | null;
  validUntil: string | null;
};

type Props = {
  source: "portal" | "org" | "admin" | "public";
  variant?: "sticky" | "inline";
  /** for admin source — which org key */
  orgKey?: string;
};

export default function CampaignTopBanner({ source, variant = "sticky", orgKey }: Props) {
  const { t } = useI18n();
  const [campaign, setCampaign] = useState<CampaignPayload | null>(null);
  const [visible, setVisible] = useState(false);

  const load = async () => {
    try {
      let res: Response;
      if (source === "portal") {
        res = await portalApiFetch("/api/promo-codes/active", { cache: "no-store" });
      } else if (source === "org") {
        res = await orgApiFetch("/org/campaigns/active", { cache: "no-store" });
      } else if (source === "admin" && orgKey) {
        res = await apiFetch("/api/promo-codes/active-public", { cache: "no-store" });
      } else {
        // public — no auth
        res = await fetch(`${API_BASE}/api/promo-codes/active-public`, { cache: "no-store" });
      }
      if (!res.ok) {
        setCampaign(null);
        return;
      }
      const data = (await res.json()) as { active?: CampaignPayload | null };
      setCampaign(data.active || null);
    } catch {
      setCampaign(null);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, orgKey]);

  /* entrance animation trigger */
  useEffect(() => {
    if (campaign) {
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
  }, [campaign]);

  const discountText = useMemo(() => {
    if (!campaign) return "";
    if (campaign.discountType === "percentage") {
      return t("campaigns.banner.percentOff").replace("{value}", String(campaign.discountValue));
    }
    return t("campaigns.banner.fixedOff").replace("{value}", String(campaign.discountValue));
  }, [campaign, t]);

  const headline = campaign?.bannerSubtitle
    || t("campaigns.banner.subtitle").replace("{discount}", discountText);

  if (!campaign) return null;

  /* ─── INLINE: seamlessly blended into the header bar ─── */
  if (variant === "inline") {
    return (
      <>
        {/* gradient + shimmer container */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute inset-0 transition-opacity duration-700 ease-out"
            style={{
              opacity: visible ? 1 : 0,
              background:
                "linear-gradient(to right, transparent 0%, rgba(109,40,217,0.5) 6%, #7c3aed 15%, #8b5cf6 35%, #8b5cf6 50%, #7c3aed 65%, rgba(139,92,246,0.3) 75%, transparent 82%)",
            }}
          />
          <div
            className="absolute inset-0 transition-opacity duration-700 ease-out"
            style={{
              opacity: visible ? 0.1 : 0,
              background:
                "linear-gradient(105deg, transparent 25%, rgba(255,255,255,0.7) 45%, transparent 65%)",
              backgroundSize: "200% 100%",
              animation: visible ? "campaign-shimmer 3.5s ease-in-out infinite" : "none",
            }}
          />
        </div>

        {/* content — centered */}
        <div
          className="relative z-[1] flex flex-1 items-center justify-center gap-5 transition-all duration-500 ease-out"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "translateX(0)" : "translateX(-20px)",
          }}
        >
          <div className="flex items-center gap-2.5">
            <Sparkles size={16} className="shrink-0 text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]" />
            <span className="text-[15px] font-bold tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.15)]">
              {headline}
            </span>
          </div>

          <span className="h-1 w-1 shrink-0 rounded-full bg-white/40" />

          <div className="group relative flex shrink-0 items-center">
            <div className="absolute -inset-1 rounded-xl bg-white/10 blur-sm" />
            <div className="relative flex items-center gap-2 rounded-xl bg-white/20 px-4 py-1.5 ring-1 ring-white/30 backdrop-blur-md">
              <Ticket size={14} className="text-amber-200" />
              <span className="text-[15px] font-extrabold tracking-[0.12em] text-white">
                {campaign.code}
              </span>
            </div>
          </div>
        </div>

        <style jsx>{`
          @keyframes campaign-shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
      </>
    );
  }

  /* ─── STICKY: mobile + public website banner ─── */
  return (
    <div
      className="w-full bg-gradient-to-r from-violet-700 via-fuchsia-600 to-violet-700 text-white shadow-[0_4px_20px_rgba(109,40,217,0.3)]"
      style={{
        animation: "campaign-fade-in 600ms ease-out",
      }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-4 px-4 py-2.5 sm:gap-6 sm:px-6">
        <Sparkles size={16} className="shrink-0 text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]" />
        <span className="text-[13px] font-semibold sm:text-[14px]">
          {headline}
        </span>
        <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/25 bg-white/15 px-3 py-1 backdrop-blur-sm">
          <Ticket size={13} className="text-amber-200" />
          <span className="text-[13px] font-extrabold tracking-widest">{campaign.code}</span>
        </div>
      </div>
      <style jsx>{`
        @keyframes campaign-fade-in {
          0% { opacity: 0; transform: translateY(-100%); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes campaign-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
