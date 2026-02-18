type HelvionLogoVariant = "light" | "dark";

export default function HelvionLogo({
  variant = "light",
  heightClassName = "h-7",
  className = "",
  alt = "Helvion",
}: {
  variant?: HelvionLogoVariant;
  heightClassName?: string;
  className?: string;
  alt?: string;
}) {
  const src = variant === "dark" ? "/helvion-full-dark.svg" : "/helvion-full-light.svg";
  return (
    <img
      src={src}
      alt={alt}
      width={280}
      height={48}
      className={`${heightClassName} w-auto ${className}`}
      decoding="async"
    />
  );
}

