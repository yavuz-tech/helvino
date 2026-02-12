// =============================================
// Widget Appearance v3 — Constants
// =============================================

export const THEMES = [
  { id: "amber", name: "Amber", color: "#F59E0B", dark: "#D97706", light: "#FEF3C7" },
  { id: "ocean", name: "Okyanus", color: "#0EA5E9", dark: "#0284C7", light: "#E0F2FE" },
  { id: "emerald", name: "Zumrut", color: "#10B981", dark: "#059669", light: "#D1FAE5" },
  { id: "violet", name: "Mor", color: "#8B5CF6", dark: "#7C3AED", light: "#EDE9FE" },
  { id: "rose", name: "Gul", color: "#F43F5E", dark: "#E11D48", light: "#FFE4E6" },
  { id: "slate", name: "Grafit", color: "#475569", dark: "#334155", light: "#F1F5F9" },
  { id: "teal", name: "Turkuaz", color: "#14B8A6", dark: "#0D9488", light: "#CCFBF1" },
  { id: "indigo", name: "Lacivert", color: "#6366F1", dark: "#4F46E5", light: "#E0E7FF" },
  // PRO Premium Themes
  {
    id: "sunset",
    name: "Gunbatimi",
    color: "#F97316",
    dark: "#C2410C",
    light: "#FFF7ED",
    pro: true,
    gradient: "linear-gradient(135deg,#F97316,#EC4899)",
  },
  {
    id: "aurora",
    name: "Aurora",
    color: "#06B6D4",
    dark: "#0E7490",
    light: "#ECFEFF",
    pro: true,
    gradient: "linear-gradient(135deg,#06B6D4,#8B5CF6)",
  },
  {
    id: "midnight",
    name: "Gece",
    color: "#1E293B",
    dark: "#0F172A",
    light: "#F8FAFC",
    pro: true,
    gradient: "linear-gradient(135deg,#1E293B,#4338CA)",
  },
  {
    id: "cherry",
    name: "Visne",
    color: "#BE123C",
    dark: "#9F1239",
    light: "#FFF1F2",
    pro: true,
    gradient: "linear-gradient(135deg,#BE123C,#F59E0B)",
  },
] as const;

export const LAUNCHERS = [
  { id: "rounded", name: "Yuvarlak", radius: "50%", w: 56, h: 56, hasText: false },
  { id: "squircle", name: "Yumusak Kare", radius: "16px", w: 56, h: 56, hasText: false },
  { id: "pill", name: "Hap", radius: "28px", w: 130, h: 48, hasText: true },
  { id: "bar", name: "Cubuk", radius: "14px", w: 170, h: 44, hasText: true },
] as const;

export const POSITIONS = [
  { id: "br", label: "Sag Alt", x: "right" as const, y: "bottom" as const },
  { id: "bl", label: "Sol Alt", x: "left" as const, y: "bottom" as const },
] as const;

export const PREVIEW_STATES = [
  { id: "launcher", label: "Baslatici", icon: "💬" },
  { id: "home", label: "Ana Ekran", icon: "🏠" },
  { id: "chat", label: "Sohbet", icon: "✉️" },
  { id: "prechat", label: "On Form", icon: "📋" },
  { id: "offline", label: "Cevrimdisi", icon: "🌙" },
] as const;

export const SIZES = [
  { id: "compact", label: "Kompakt", w: 340, h: 440 },
  { id: "standard", label: "Standart", w: 380, h: 520 },
  { id: "large", label: "Genis", w: 420, h: 580 },
] as const;

export const BACKGROUNDS = [
  { id: "none", name: "Yok", pattern: null },
  { id: "dots", name: "Noktalar", pattern: "radial-gradient(circle, currentColor 1px, transparent 1px)" },
  {
    id: "lines",
    name: "Cizgiler",
    pattern:
      "repeating-linear-gradient(0deg, transparent, transparent 14px, currentColor 14px, currentColor 15px)",
  },
  {
    id: "grid",
    name: "Izgara",
    pattern: "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
  },
  { id: "waves", name: "Dalga", pattern: null, isSvg: true },
  // PRO
  {
    id: "diamonds",
    name: "Elmas",
    pattern:
      "repeating-linear-gradient(45deg, transparent, transparent 8px, currentColor 8px, currentColor 9px), repeating-linear-gradient(-45deg, transparent, transparent 8px, currentColor 8px, currentColor 9px)",
    pro: true,
  },
  {
    id: "circles",
    name: "Halkalar",
    pattern: "radial-gradient(circle, transparent 8px, currentColor 9px, transparent 10px)",
    pro: true,
  },
  {
    id: "confetti",
    name: "Konfeti",
    pattern: "radial-gradient(circle 2px, currentColor 1px, transparent 2px)",
    pro: true,
    size: "12px 18px",
  },
] as const;

export const ATTENTION_GRABBERS = [
  { id: "none", label: "Yok", emoji: "🚫" },
  { id: "wave", label: "El Salla", emoji: "👋" },
  { id: "message", label: "Mesaj Balonu", emoji: "💬" },
  { id: "bounce", label: "Zipla", emoji: "🔔" },
  { id: "pulse", label: "Nabiz", emoji: "💫" },
] as const;

export const DAYS_TR = ["Pzt", "Sal", "Car", "Per", "Cum", "Cmt", "Paz"] as const;

export const AI_TONES = [
  { id: "friendly", label: "Samimi", emoji: "😊", desc: "Sicak, emoji kullanan, rahat ton" },
  { id: "professional", label: "Profesyonel", emoji: "👔", desc: "Resmi, kurumsal iletisim" },
  { id: "neutral", label: "Notr", emoji: "⚖️", desc: "Dengeli, ne resmi ne rahat" },
  { id: "humorous", label: "Eglenceli", emoji: "😄", desc: "Hafif mizahi, enerjik" },
] as const;

export const AI_LENGTHS = [
  { id: "concise", label: "Kisa", desc: "Oz ve net yanitlar" },
  { id: "standard", label: "Standart", desc: "Dengeli detay" },
  { id: "thorough", label: "Detayli", desc: "Kapsamli aciklamalar" },
] as const;

export const AI_MODELS = [
  { id: "auto", label: "Otomatik", desc: "En uygun modeli sec" },
  { id: "fast", label: "Hizli", desc: "Dusuk gecikme, basit sorular" },
  { id: "balanced", label: "Dengeli", desc: "Hiz-kalite dengesi" },
  { id: "quality", label: "Kaliteli", desc: "En yuksek dogruluk" },
] as const;
