const THEME_SHOWCASE = [
  { id: "midnight-blue", name: "Gece Mavisi", color: "#1E293B", ring: "#334155" },
  { id: "ocean-teal", name: "Okyanus", color: "#0D9488", ring: "#14B8A6" },
  { id: "sunset-orange", name: "Gun Batimi", color: "#F59E0B", ring: "#D97706" },
  { id: "royal-purple", name: "Kraliyet", color: "#8B5CF6", ring: "#7C3AED" },
  { id: "charcoal-cream", name: "Komur", color: "#44403C", ring: "#57534E" },
  { id: "emerald-forest", name: "Zumrut", color: "#059669", ring: "#047857" },
] as const;

const LEGACY_THEME_ID_MAP: Record<string, (typeof THEME_SHOWCASE)[number]["id"]> = {
  midnight: "midnight-blue",
  ocean: "ocean-teal",
  sunset: "sunset-orange",
  royal: "royal-purple",
  charcoal: "charcoal-cream",
  emerald: "emerald-forest",
};

export function resolveThemeId(id: string): (typeof THEME_SHOWCASE)[number]["id"] | null {
  if ((THEME_SHOWCASE as readonly { id: string }[]).some((t) => t.id === id)) {
    return id as (typeof THEME_SHOWCASE)[number]["id"];
  }
  return LEGACY_THEME_ID_MAP[id] ?? null;
}

export function MiniWidget({
  color,
  ring,
}: {
  color: string;
  ring: string;
}) {
  return (
    <div className="relative h-16 w-full overflow-hidden rounded-lg bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
      <div
        className="flex h-5 items-center gap-1.5 px-2"
        style={{ background: `linear-gradient(135deg, ${color}, ${ring})` }}
      >
        <span className="h-2 w-2 rounded-full bg-white/30" />
        <span className="h-1 w-8 rounded bg-white/40" />
      </div>
      <div className="space-y-1 px-2 py-1.5">
        <div className="h-[3px] w-7 rounded bg-slate-200" />
        <div className="h-[3px] w-5 rounded bg-slate-200" />
      </div>
      <span
        className="absolute bottom-1 right-1 h-[14px] w-[14px] rounded-full shadow-[0_2px_6px]"
        style={{ background: `linear-gradient(135deg, ${color}, ${ring})`, boxShadow: `0 2px 6px ${color}66` }}
      />
    </div>
  );
}

export { THEME_SHOWCASE };
