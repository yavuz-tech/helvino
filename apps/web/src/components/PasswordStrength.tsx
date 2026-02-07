"use client";

import { useMemo } from "react";
import { Check, X } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import type { TranslationKey } from "@/i18n/translations";

interface Props {
  password: string;
  minLength?: number;
}

type Strength = "weak" | "ok" | "strong";

function evaluate(pw: string, minLength: number) {
  const hasLength = pw.length >= minLength;
  const hasLetter = /[a-zA-Z]/.test(pw);
  const hasDigit = /\d/.test(pw);

  const requirements: { key: TranslationKey; met: boolean }[] = [
    { key: "passwordReq.minLength", met: hasLength },
    { key: "passwordReq.letter", met: hasLetter },
    { key: "passwordReq.number", met: hasDigit },
  ];

  const score = [hasLength, hasLetter, hasDigit].filter(Boolean).length;

  let strength: Strength;
  if (score <= 1) strength = "weak";
  else if (score === 2) strength = "ok";
  else strength = "strong";

  // bar percentage: 0, 33, 66, 100
  const pct = score === 0 ? 0 : score === 1 ? 33 : score === 2 ? 66 : 100;

  return { requirements, strength, score, pct };
}

const strengthStyle: Record<Strength, { bar: string; text: string; labelKey: TranslationKey }> = {
  weak: { bar: "bg-red-500", text: "text-red-600", labelKey: "passwordStrength.weak" },
  ok: { bar: "bg-amber-500", text: "text-amber-600", labelKey: "passwordStrength.ok" },
  strong: { bar: "bg-emerald-500", text: "text-emerald-600", labelKey: "passwordStrength.strong" },
};

export default function PasswordStrength({ password, minLength = 8 }: Props) {
  const { t } = useI18n();
  const { requirements, strength, pct } = useMemo(
    () => evaluate(password, minLength),
    [password, minLength],
  );
  const style = strengthStyle[strength];

  if (!password) return null;

  return (
    <div className="mt-2.5 space-y-2">
      {/* ── Strength bar ── */}
      <div className="flex items-center gap-2.5">
        <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ease-out ${style.bar}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className={`text-xs font-semibold ${style.text} min-w-[3.5rem] text-right`}>
          {t(style.labelKey)}
        </span>
      </div>

      {/* ── Requirements checklist ── */}
      <ul className="space-y-1">
        {requirements.map((req) => (
          <li key={req.key} className="flex items-center gap-2 text-xs">
            {req.met ? (
              <Check size={13} strokeWidth={2.5} className="text-emerald-500 shrink-0" />
            ) : (
              <X size={13} strokeWidth={2.5} className="text-slate-300 shrink-0" />
            )}
            <span className={req.met ? "text-slate-700" : "text-slate-400"}>
              {t(req.key)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
