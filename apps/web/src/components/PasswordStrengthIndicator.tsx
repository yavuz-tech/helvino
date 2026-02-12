"use client";

import { useMemo } from "react";
import { Check, X } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

interface Props {
  password: string;
}

interface Requirement {
  key: string;
  met: boolean;
}

type Strength = "weak" | "fair" | "good" | "strong";

function evaluatePassword(pw: string) {
  const hasLength = pw.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(pw);
  const hasDigit = /\d/.test(pw);
  const hasMixed = /[a-z]/.test(pw) && /[A-Z]/.test(pw);
  const hasSpecial = /[^a-zA-Z0-9]/.test(pw);

  const requirements: Requirement[] = [
    { key: "pwStrength.reqLength", met: hasLength },
    { key: "pwStrength.reqLetter", met: hasLetter },
    { key: "pwStrength.reqDigit", met: hasDigit },
    { key: "pwStrength.reqMixed", met: hasMixed },
    { key: "pwStrength.reqSpecial", met: hasSpecial },
  ];

  // Score: 0-4
  let score = 0;
  if (hasLength) score++;
  if (hasLetter && hasDigit) score++; // mandatory pair
  if (hasMixed) score++;
  if (hasSpecial) score++;
  if (pw.length >= 12) score++;

  let strength: Strength;
  if (score <= 1) strength = "weak";
  else if (score === 2) strength = "fair";
  else if (score === 3) strength = "good";
  else strength = "strong";

  return { requirements, strength, score };
}

const strengthConfig: Record<Strength, { color: string; bg: string; bars: number }> = {
  weak: { color: "text-red-600", bg: "bg-red-500", bars: 1 },
  fair: { color: "text-amber-600", bg: "bg-amber-500", bars: 2 },
  good: { color: "text-amber-600", bg: "bg-amber-500", bars: 3 },
  strong: { color: "text-emerald-600", bg: "bg-emerald-500", bars: 4 },
};

export default function PasswordStrengthIndicator({ password }: Props) {
  const { t } = useI18n();
  const { requirements, strength } = useMemo(() => evaluatePassword(password), [password]);
  const config = strengthConfig[strength];

  if (!password) return null;

  return (
    <div className="mt-2 space-y-2">
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1 flex-1">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-200 ${
                i <= config.bars ? config.bg : "bg-amber-100"
              }`}
            />
          ))}
        </div>
        <span className={`text-xs font-medium ${config.color} min-w-[3rem] text-right`}>
          {t(`pwStrength.${strength}` as Parameters<typeof t>[0])}
        </span>
      </div>

      {/* Requirements checklist */}
      <ul className="space-y-0.5">
        {requirements.map((req) => (
          <li key={req.key} className="flex items-center gap-1.5 text-xs">
            {req.met ? (
              <Check size={12} className="text-emerald-500 shrink-0" />
            ) : (
              <X size={12} className="text-amber-400 shrink-0" />
            )}
            <span className={req.met ? "text-amber-700" : "text-amber-500"}>
              {t(req.key as Parameters<typeof t>[0])}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
