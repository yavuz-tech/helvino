"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Gift, X } from "lucide-react";
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
  const ctaHref = source === "portal" ? "/portal/pricing" : "/pricing";

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
        className="relative z-[1] hidden min-h-[44px] items-center justify-center gap-4 rounded-xl border px-6 py-2.5 lg:flex shadow-[0_2px_8px_rgba(245,158,11,0.15)]"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(-6px)",
          transition: "all 420ms ease",
          background: "linear-gradient(135deg, #F59E0B, #D97706)",
          borderColor: "rgba(255,255,255,0.18)",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 p-1.5">
            <Gift size={14} className="text-white" />
          </div>
          <p className="truncate font-[var(--font-heading)] text-sm font-semibold text-white">{headline}</p>
        </div>

        <div className="mx-1 flex items-center gap-1 rounded-md bg-white/25 px-3 py-1 text-xs font-bold tracking-[0.5px] text-white">
          <span aria-hidden="true">🎟</span>
          <span className="font-[var(--font-body)] tracking-[0.08em]">
            {campaign.code}
          </span>
        </div>

        <Link
          href={ctaHref}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-1.5 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-50"
        >
          {t("campaigns.banner.cta")}
          <ArrowRight size={13} />
        </Link>
        <button
          type="button"
          onClick={() => setCampaign(null)}
          className="absolute right-4 inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/20 p-1 text-white transition-colors hover:bg-white/30"
          aria-label={t("common.close")}
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  /* ─── STICKY: mobile + public warm premium banner ─── */
  return (
    <div
      className="relative w-full border-b px-6 py-2.5 shadow-[0_2px_8px_rgba(245,158,11,0.15)]"
      style={{
        animation: "campaign-fade-in 600ms ease-out",
        background: "linear-gradient(135deg, #F59E0B, #D97706)",
        borderColor: "rgba(180,83,9,0.35)",
      }}
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 p-1.5">
          <Gift size={14} className="text-white" />
        </div>
        <span className="font-[var(--font-heading)] text-sm font-semibold text-white">
          {headline}
        </span>
        <div className="flex shrink-0 items-center gap-1 rounded-md bg-white/25 px-3 py-1 text-xs font-bold tracking-[0.5px] text-white">
          <span aria-hidden="true">🎟</span>
          <span className="font-[var(--font-body)] tracking-[0.08em]">{campaign.code}</span>
        </div>
        <Link
          href={ctaHref}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-1.5 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-50"
        >
          {t("campaigns.banner.cta")}
          <ArrowRight size={13} />
        </Link>
        <button
          type="button"
          onClick={() => setCampaign(null)}
          className="absolute right-4 inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/20 p-1 text-white transition-colors hover:bg-white/30"
          aria-label={t("common.close")}
        >
          <X size={14} />
        </button>
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
