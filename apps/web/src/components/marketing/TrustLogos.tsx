"use client";

interface TrustLogosProps {
  /** Label above logos */
  label?: string;
  /** Dark background variant */
  dark?: boolean;
  className?: string;
}

const LOGOS = [
  { name: "Shopify", width: 90 },
  { name: "Stripe", width: 70 },
  { name: "Vercel", width: 80 },
  { name: "Notion", width: 80 },
  { name: "Linear", width: 70 },
  { name: "Figma", width: 60 },
];

export default function TrustLogos({
  label = "Trusted by 10,000+ businesses worldwide",
  dark = false,
  className = "",
}: TrustLogosProps) {
  return (
    <div className={`py-12 ${className}`}>
      <p
        className={`text-center text-xs font-semibold uppercase tracking-[0.1em] mb-8 ${
          dark ? "text-slate-500" : "text-[#8E8EA0]"
        }`}
      >
        {label}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
        {LOGOS.map((logo) => (
          <div
            key={logo.name}
            className={`flex items-center justify-center h-8 ${
              dark ? "opacity-40 hover:opacity-60" : "opacity-30 hover:opacity-50"
            } transition-opacity duration-200`}
            style={{ minWidth: logo.width }}
          >
            <span
              className={`text-sm font-bold tracking-wide ${
                dark ? "text-white" : "text-[#0D0D12]"
              }`}
            >
              {logo.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
