"use client";

import HelvionLogo from "@/components/brand/HelvionLogo";
import { useI18n } from "@/i18n/I18nContext";
import type { TranslationKey } from "@/i18n/translations";

export default function HelvionPoweredBy({
  href = "https://helvion.io",
  prefixKey = "widgetPreview.poweredByPrefix",
  suffixKey = "widgetPreview.poweredBySuffix",
  logoVariant = "light",
  logoHeightClassName = "h-3.5",
  textClassName = "text-[11px] font-semibold text-stone-500",
  containerClassName = "inline-flex items-center gap-1.5",
}: {
  href?: string;
  prefixKey?: TranslationKey;
  suffixKey?: TranslationKey;
  logoVariant?: "light" | "dark";
  logoHeightClassName?: string;
  textClassName?: string;
  containerClassName?: string;
}) {
  const { t } = useI18n();
  const prefix = String(t(prefixKey) || "");
  const suffix = String(t(suffixKey) || "");
  const hasPrefix = prefix.trim().length > 0;
  const hasSuffix = suffix.trim().length > 0;

  return (
    <span className={containerClassName}>
      {hasPrefix && <span className={textClassName}>{prefix}</span>}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center"
        aria-label="Helvion"
      >
        <HelvionLogo variant={logoVariant} heightClassName={logoHeightClassName} className="align-middle" />
      </a>
      {hasSuffix && <span className={textClassName}>{suffix}</span>}
    </span>
  );
}

