"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/i18n/I18nContext";

/**
 * OnboardingOverlay — lightweight first-time user onboarding.
 *
 * Props:
 *   area: "admin" | "portal" — determines step content
 *   storageKey: unique localStorage key for "don't show again"
 *
 * Behavior:
 * - Shown on first visit if not dismissed
 * - 3–4 steps: welcome → core action → security → done
 * - "Don't show again" persists to localStorage
 */

interface OnboardingOverlayProps {
  area: "admin" | "portal";
  storageKey?: string;
}

export default function OnboardingOverlay({
  area,
  storageKey,
}: OnboardingOverlayProps) {
  const { t } = useI18n();
  const key = storageKey || `helvino_onboarding_${area}_done`;
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      const done = localStorage.getItem(key);
      if (!done) setVisible(true);
    } catch {
      // SSR or incognito — show anyway
      setVisible(true);
    }
  }, [key]);

  if (!visible) return null;

  const steps =
    area === "admin"
      ? [
          {
            icon: "👋",
            title: t("onboarding.admin.welcomeTitle"),
            desc: t("onboarding.admin.welcomeDesc"),
          },
          {
            icon: "💬",
            title: t("onboarding.admin.inboxTitle"),
            desc: t("onboarding.admin.inboxDesc"),
          },
          {
            icon: "🔒",
            title: t("onboarding.admin.securityTitle"),
            desc: t("onboarding.admin.securityDesc"),
          },
          {
            icon: "✅",
            title: t("onboarding.admin.readyTitle"),
            desc: t("onboarding.admin.readyDesc"),
          },
        ]
      : [
          {
            icon: "👋",
            title: t("onboarding.portal.welcomeTitle"),
            desc: t("onboarding.portal.welcomeDesc"),
          },
          {
            icon: "📋",
            title: t("onboarding.portal.embedTitle"),
            desc: t("onboarding.portal.embedDesc"),
          },
          {
            icon: "🔒",
            title: t("onboarding.portal.securityTitle"),
            desc: t("onboarding.portal.securityDesc"),
          },
          {
            icon: "✅",
            title: t("onboarding.portal.readyTitle"),
            desc: t("onboarding.portal.readyDesc"),
          },
        ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  const dismiss = (dontShowAgain: boolean) => {
    if (dontShowAgain) {
      try {
        localStorage.setItem(key, "1");
      } catch { /* ok */ }
    }
    setVisible(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 pt-5">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === step ? "bg-amber-500" : "bg-amber-200"
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-8 py-6 text-center">
          <div className="text-4xl mb-4">{current.icon}</div>
          <h2 className="text-xl font-semibold text-amber-900 mb-2">
            {current.title}
          </h2>
          <p className="text-sm text-amber-700 leading-relaxed">
            {current.desc}
          </p>
        </div>

        {/* Actions */}
        <div className="px-8 pb-6 space-y-3">
          <div className="flex gap-3">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="flex-1 px-4 py-2.5 border border-[#F3E8D8] text-amber-800 rounded-lg hover:bg-[#FFFBF5] transition-colors text-sm font-medium"
              >
                {t("common.back")}
              </button>
            )}
            <button
              onClick={() => {
                if (isLast) {
                  dismiss(true);
                } else {
                  setStep(step + 1);
                }
              }}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg hover:from-amber-600 hover:to-amber-700 transition-colors text-sm font-medium"
            >
              {isLast ? t("onboarding.getStarted") : t("onboarding.next")}
            </button>
          </div>
          <button
            onClick={() => dismiss(true)}
            className="w-full text-xs text-amber-500 hover:text-amber-700 transition-colors"
          >
            {t("onboarding.dontShowAgain")}
          </button>
        </div>
      </div>
    </div>
  );
}
