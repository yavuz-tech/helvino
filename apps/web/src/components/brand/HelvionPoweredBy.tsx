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
  containerClassName = "inline-flex items-center gap-[7px]",
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

  return (
    <span className={containerClassName}>
      <span className={textClassName}>{t(prefixKey)}</span>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center"
        aria-label="Helvion"
      >
        <HelvionLogo variant={logoVariant} heightClassName={logoHeightClassName} />
      </a>
      <span className={textClassName}>{t(suffixKey)}</span>
    </span>
  );
}

