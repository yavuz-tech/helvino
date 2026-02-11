"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Sparkles, Ticket } from "lucide-react";
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
  const ctaHref = source === "portal" ? "/portal/billing" : "/pricing";

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

  /* ─── INLINE: warm premium header banner ─── */
  if (variant === "inline") {
    return (
      <div
        className="relative z-[1] mx-4 hidden min-h-[44px] items-center rounded-2xl border px-3 py-2 lg:flex"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(-6px)",
          transition: "all 420ms ease",
          background: "linear-gradient(135deg, #FEF3E2, #FDE8CC)",
          borderColor: "#FDB462",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-xl shadow-[0_8px_18px_rgba(245,158,11,0.25)]"
            style={{ background: "linear-gradient(135deg, #FDB462, #F59E0B)" }}
          >
            <Sparkles size={14} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-[var(--font-heading)] text-[14px] font-bold text-[#1A1D23]">{headline}</p>
          </div>
        </div>

        <div
          className="mx-3 flex items-center gap-2 rounded-xl border px-2.5 py-1.5"
          style={{
            background: "rgba(255,255,255,0.65)",
            borderColor: "rgba(253,180,98,0.8)",
          }}
        >
          <Ticket size={13} className="text-[#F59E0B]" />
          <span className="font-[var(--font-body)] text-[12px] font-bold tracking-[0.1em] text-[#1A1D23]">
            {campaign.code}
          </span>
        </div>

        <Link
          href={ctaHref}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-[var(--font-body)] text-[12px] font-semibold text-white transition-all duration-200 hover:brightness-95 hover:shadow-[0_10px_20px_rgba(251,146,60,0.35)]"
          style={{ background: "linear-gradient(135deg, #FDB462, #F59E0B)" }}
        >
          {t("campaigns.banner.cta")}
          <ArrowRight size={13} />
        </Link>
      </div>
    );
  }

  /* ─── STICKY: mobile + public warm premium banner ─── */
  return (
    <div
      className="w-full border-b shadow-[0_8px_24px_rgba(245,158,11,0.12)]"
      style={{
        animation: "campaign-fade-in 600ms ease-out",
        background: "linear-gradient(135deg, #FEF3E2, #FDE8CC)",
        borderColor: "#FDB462",
      }}
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-2.5 sm:gap-3 sm:px-6">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-xl shadow-[0_8px_18px_rgba(245,158,11,0.25)]"
          style={{ background: "linear-gradient(135deg, #FDB462, #F59E0B)" }}
        >
          <Sparkles size={14} className="text-white" />
        </div>
        <span className="font-[var(--font-heading)] text-[14px] font-bold text-[#1A1D23]">
          {headline}
        </span>
        <div
          className="flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1"
          style={{
            background: "rgba(255,255,255,0.65)",
            borderColor: "rgba(253,180,98,0.8)",
          }}
        >
          <Ticket size={13} className="text-[#F59E0B]" />
          <span className="font-[var(--font-body)] text-[12px] font-bold tracking-[0.1em] text-[#1A1D23]">{campaign.code}</span>
        </div>
        <Link
          href={ctaHref}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-[var(--font-body)] text-[12px] font-semibold text-white transition-all duration-200 hover:brightness-95 hover:shadow-[0_10px_20px_rgba(251,146,60,0.35)]"
          style={{ background: "linear-gradient(135deg, #FDB462, #F59E0B)" }}
        >
          {t("campaigns.banner.cta")}
          <ArrowRight size={13} />
        </Link>
      </div>
      <style jsx>{`
        @keyframes campaign-fade-in {
          0% { opacity: 0; transform: translateY(-100%); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
