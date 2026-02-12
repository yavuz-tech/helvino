"use client";

import { p } from "@/styles/theme";

type Props = {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

export default function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: Props) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      className={`${p.toggleRow} ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"} group w-full text-left`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-amber-800">{label}</p>
        {description && (
          <p className="mt-1 text-[12px] leading-snug text-amber-600">{description}</p>
        )}
      </div>
      {/* Switch Track */}
      <div
        className={[
          "relative h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200",
          checked ? "bg-amber-500" : "bg-amber-200 group-hover:bg-amber-300",
        ].join(" ")}
      >
        {/* Switch Thumb */}
        <div
          className={[
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200",
            checked ? "translate-x-[22px]" : "translate-x-0.5",
          ].join(" ")}
        />
      </div>
    </button>
  );
}
