"use client";

import { Bot, Zap, ArrowRight, X, Sparkles, Crown } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/i18n/I18nContext";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLimit?: number;
  currentPlan?: string;
  /** "quota" = AI messages used up, "plan" = feature requires higher plan */
  reason?: "quota" | "plan";
  /** Minimum plan needed (shown when reason="plan") */
  requiredPlan?: string;
}

export default function UpgradeModal({ isOpen, onClose, currentLimit = 100, currentPlan = "free", reason = "plan", requiredPlan = "starter" }: UpgradeModalProps) {
  const { t } = useI18n();

  if (!isOpen) return null;

  const isQuotaReason = reason === "quota";

  const plans = [
    {
      key: "starter",
      name: t("upgrade.starter"),
      price: t("upgrade.starterPrice"),
      messages: t("upgrade.starterMessages"),
      color: "from-blue-500 to-indigo-600",
      bgHover: "hover:bg-blue-50",
      border: "border-blue-200",
      highlight: isQuotaReason ? currentPlan === "free" : requiredPlan === "starter",
    },
    {
      key: "pro",
      name: t("upgrade.pro"),
      price: t("upgrade.proPrice"),
      messages: t("upgrade.proMessages"),
      color: "from-purple-500 to-indigo-600",
      bgHover: "hover:bg-purple-50",
      border: "border-purple-200",
      highlight: isQuotaReason ? currentPlan === "starter" : requiredPlan === "pro",
    },
    {
      key: "enterprise",
      name: t("upgrade.enterprise"),
      price: t("upgrade.enterprisePrice"),
      messages: t("upgrade.enterpriseMessages"),
      color: "from-amber-500 to-orange-600",
      bgHover: "hover:bg-amber-50",
      border: "border-amber-200",
      highlight: false,
    },
  ];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        {/* Decorative top gradient */}
        <div className="h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

        {/* Close button */}
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors z-10">
          <X size={16} className="text-slate-500" />
        </button>

        {/* Content */}
        <div className="p-8">
          {/* Icon */}
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg ${
            isQuotaReason
              ? "bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/20"
              : "bg-gradient-to-br from-indigo-500 to-purple-600 shadow-indigo-500/20"
          }`}>
            {isQuotaReason ? <Bot size={28} className="text-white" /> : <Zap size={28} className="text-white" />}
          </div>

          <h2 className="text-xl font-extrabold text-slate-900 text-center mb-2">
            {isQuotaReason ? t("upgrade.title") : t("upgrade.planRequired")}
          </h2>
          <p className="text-sm text-slate-500 text-center mb-1">
            {isQuotaReason
              ? t("upgrade.description").replace("{limit}", String(currentLimit))
              : t("upgrade.planRequiredDesc").replace("{plan}", requiredPlan === "pro" ? "Pro" : "Starter+")}
          </p>
          <p className="text-sm text-slate-600 text-center font-medium mb-6">
            {isQuotaReason ? t("upgrade.continue") : t("upgrade.unlockFeatures")}
          </p>

          {/* Plan cards */}
          <div className="space-y-3">
            {plans.map((plan) => (
              <Link
                key={plan.key}
                href="/portal/billing"
                onClick={onClose}
                className={`flex items-center gap-4 p-4 rounded-xl border ${plan.border} ${plan.bgHover} transition-all ${plan.highlight ? "ring-2 ring-blue-400 ring-offset-1" : ""}`}
              >
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${plan.color} flex items-center justify-center flex-shrink-0`}>
                  {plan.key === "enterprise" ? <Crown size={18} className="text-white" /> : <Zap size={18} className="text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-900">{plan.name}</p>
                    {plan.highlight && (
                      <span className="text-[9px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                        <Sparkles size={8} className="inline mr-0.5" />
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{plan.messages}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-extrabold text-slate-900">{plan.price}</p>
                </div>
                <ArrowRight size={14} className="text-slate-400 flex-shrink-0" />
              </Link>
            ))}
          </div>

          {/* Maybe Later */}
          <button onClick={onClose} className="w-full mt-4 text-sm text-slate-500 hover:text-slate-700 font-medium py-2 text-center transition-colors">
            {t("upgrade.maybeLater")}
          </button>
        </div>
      </div>
    </div>
  );
}
