// =============================================
// Widget Appearance v3 — Helpers
// =============================================

/** Hex renk kodunu RGB string'e cevirir: "#F59E0B" -> "245,158,11" */
export const hexToRgb = (hex: string): string => {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r},${g},${b}`;
};

/** Warm Premium style sistemi */
export const getStyleSystem = () => ({
  font: "'Manrope', sans-serif",
  fontH: "'Satoshi', sans-serif",
  fontMono: "'JetBrains Mono', monospace",
  bg: "#FAF9F7",
  card: "#FFFCF9",
  border: "1px solid #F0E6D6",
  inputBg: "#FFFCF8",
  inputBorder: "1.5px solid #E8E0D4",
  label: {
    fontFamily: "'Manrope', sans-serif",
    fontSize: "12px",
    fontWeight: 600,
    color: "#475569",
    marginBottom: "6px",
    display: "block" as const,
  },
  input: {
    width: "100%",
    padding: "9px 13px",
    borderRadius: "10px",
    border: "1.5px solid #E8E0D4",
    fontFamily: "'Manrope', sans-serif",
    fontSize: "13px",
    color: "#1A1D23",
    outline: "none",
    background: "#FFFCF8",
    transition: "border 0.2s",
  },
});

/** Tema renklerini hesaplar */
export const computeThemeColors = (
  theme: { color: string; dark: string; light?: string; gradient?: string },
  useCustom: boolean,
  customColor: string
) => {
  const ac = useCustom ? customColor : theme.color;
  const ad = useCustom ? customColor : theme.dark;
  const al = useCustom ? `${customColor}15` : theme.light || `${theme.color}15`;
  const ag = useCustom
    ? `linear-gradient(135deg,${customColor},${customColor})`
    : theme.gradient || `linear-gradient(135deg,${theme.color},${theme.dark})`;
  const acRgb = hexToRgb(ac);
  const adRgb = hexToRgb(ad);

  return { ac, ad, al, ag, acRgb, adRgb };
};
