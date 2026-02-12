import type { ReactNode } from "react";

export function OptionBtn({
  selected,
  themeColor,
  onClick,
  disabled,
  children,
}: {
  selected: boolean;
  themeColor: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 font-[var(--font-heading)] text-[12.5px] font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50"
      style={
        selected
          ? {
              background: `linear-gradient(135deg, ${themeColor}, ${themeColor}DD)`,
              color: "#FFFFFF",
              boxShadow: `0 3px 12px ${themeColor}4D`,
            }
          : {
              background: "#FFFFFF",
              color: "#64748B",
              border: "1.5px solid rgba(0,0,0,0.08)",
            }
      }
    >
      {children}
    </button>
  );
}

export function ColorRow({
  label,
  value,
  themeColor,
  disabled,
  onChange,
  validate,
}: {
  label: string;
  value: string;
  themeColor: string;
  disabled: boolean;
  onChange: (v: string) => void;
  validate: (v: string) => boolean;
}) {
  const safe = validate(value) ? value : "#000000";
  return (
    <div className="group mx-2 flex items-center gap-3.5 rounded-[14px] px-4 py-3 transition-all hover:bg-black/[0.015]">
      <label className="relative flex h-[42px] w-[42px] flex-shrink-0 cursor-pointer">
        <input
          type="color"
          value={safe}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
        <div
          className="h-[42px] w-[42px] rounded-xl border-[3px] border-white transition-all"
          style={{
            backgroundColor: safe,
            boxShadow: `0 3px 12px ${safe}4D`,
            outline: "2px solid transparent",
          }}
        />
      </label>
      <div className="min-w-0 flex-1">
        <p className="font-[var(--font-heading)] text-[13px] font-semibold text-[#1A1D23]">{label}</p>
        <p className="font-[var(--font-body)] text-[12px] uppercase tracking-[0.05em] text-[#94A3B8]">{safe}</p>
      </div>
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/[0.03] opacity-30 transition-opacity group-hover:opacity-100">
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </span>
      <style jsx>{`
        .group:hover label > div {
          outline-color: ${themeColor};
        }
      `}</style>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          if (validate(v) || v.startsWith("#")) onChange(v);
        }}
        disabled={disabled}
        className="hidden"
      />
    </div>
  );
}
