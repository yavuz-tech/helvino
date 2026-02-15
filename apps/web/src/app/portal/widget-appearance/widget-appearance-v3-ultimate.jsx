import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useI18n } from "@/i18n/I18nContext";

/* ═══════════════════════════════════════════════════════════════
   HELVION.IO — Widget Görünüm Ayarları v2 — ULTIMATE
   "Müşterinin para vermek için can atacağı" seviyede
   ═══════════════════════════════════════════════════════════════ */

// ── Themes ──
const THEMES = [
  { id: "amber", name: "Amber", color: "#F59E0B", dark: "#D97706", light: "#FEF3C7" },
  { id: "ocean", name: "Okyanus", color: "#0EA5E9", dark: "#0284C7", light: "#E0F2FE" },
  { id: "emerald", name: "Zümrüt", color: "#10B981", dark: "#059669", light: "#D1FAE5" },
  { id: "violet", name: "Mor", color: "#8B5CF6", dark: "#7C3AED", light: "#EDE9FE" },
  { id: "rose", name: "Gül", color: "#F43F5E", dark: "#E11D48", light: "#FFE4E6" },
  { id: "slate", name: "Grafit", color: "#475569", dark: "#334155", light: "#F1F5F9" },
  { id: "teal", name: "Turkuaz", color: "#14B8A6", dark: "#0D9488", light: "#CCFBF1" },
  { id: "indigo", name: "Lacivert", color: "#6366F1", dark: "#4F46E5", light: "#E0E7FF" },
  // PRO Premium Themes
  { id: "sunset", name: "Günbatımı", color: "#F97316", dark: "#C2410C", light: "#FFF7ED", pro: true, gradient: "linear-gradient(135deg,#F97316,#EC4899)" },
  { id: "aurora", name: "Aurora", color: "#06B6D4", dark: "#0E7490", light: "#ECFEFF", pro: true, gradient: "linear-gradient(135deg,#06B6D4,#8B5CF6)" },
  { id: "midnight", name: "Gece", color: "#1E293B", dark: "#0F172A", light: "#F8FAFC", pro: true, gradient: "linear-gradient(135deg,#1E293B,#4338CA)" },
  { id: "cherry", name: "Vişne", color: "#BE123C", dark: "#9F1239", light: "#FFF1F2", pro: true, gradient: "linear-gradient(135deg,#BE123C,#F59E0B)" },
];

const LAUNCHERS = [
  { id: "rounded", name: "Yuvarlak", radius: "50%", w: 56, h: 56 },
  { id: "squircle", name: "Yumuşak Kare", radius: "16px", w: 56, h: 56 },
  { id: "pill", name: "Hap", radius: "28px", w: 130, h: 48, hasText: true },
  { id: "bar", name: "Çubuk", radius: "14px", w: 170, h: 44, hasText: true },
];

const POSITIONS = [
  { id: "br", label: "Sağ Alt", x: "right", y: "bottom" },
  { id: "bl", label: "Sol Alt", x: "left", y: "bottom" },
];

const PREVIEW_STATES = [
  { id: "launcher", label: "Başlatıcı", icon: "💬" },
  { id: "home", label: "Ana Ekran", icon: "🏠" },
  { id: "chat", label: "Sohbet", icon: "✉️" },
  { id: "prechat", label: "Ön Form", icon: "📋" },
  { id: "offline", label: "Çevrimdışı", icon: "🌙" },
];

const SIZES = [
  { id: "compact", label: "Kompakt", w: 340, h: 440 },
  { id: "standard", label: "Standart", w: 380, h: 520 },
  { id: "large", label: "Geniş", w: 420, h: 580 },
];

const BACKGROUNDS = [
  { id: "none", name: "Yok", pattern: null },
  { id: "dots", name: "Noktalar", pattern: "radial-gradient(circle, currentColor 1px, transparent 1px)" },
  { id: "lines", name: "Çizgiler", pattern: "repeating-linear-gradient(0deg, transparent, transparent 14px, currentColor 14px, currentColor 15px)" },
  { id: "grid", name: "Izgara", pattern: "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)" },
  { id: "waves", name: "Dalga", pattern: null, isSvg: true },
  // PRO
  { id: "diamonds", name: "Elmas", pattern: "repeating-linear-gradient(45deg, transparent, transparent 8px, currentColor 8px, currentColor 9px), repeating-linear-gradient(-45deg, transparent, transparent 8px, currentColor 8px, currentColor 9px)", pro: true },
  { id: "circles", name: "Halkalar", pattern: "radial-gradient(circle, transparent 8px, currentColor 9px, transparent 10px)", pro: true },
  { id: "confetti", name: "Konfeti", pattern: "radial-gradient(circle 2px, currentColor 1px, transparent 2px)", pro: true, size: "12px 18px" },
];

const ATTENTION_GRABBERS = [
  { id: "none", label: "Yok", emoji: "🚫" },
  { id: "wave", label: "El Salla", emoji: "👋" },
  { id: "message", label: "Mesaj Balonu", emoji: "💬" },
  { id: "bounce", label: "Zıpla", emoji: "🔔" },
  { id: "pulse", label: "Nabız", emoji: "💫" },
];

const DAYS_TR = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

// ════ COMPONENTS ════

function Toggle({ checked, onChange, label, desc, pro, disabled }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "14px 0", borderBottom: "1px solid #F3EDE4",
      opacity: disabled ? 0.45 : 1, pointerEvents: disabled ? "none" : "auto",
    }}>
      <div style={{ flex: 1, marginRight: 16 }}>
        <div style={{ fontFamily: "'Satoshi',sans-serif", fontSize: 13.5, fontWeight: 700, color: "#1A1D23", display: "flex", alignItems: "center", gap: 7 }}>
          {label}
          {pro && <span style={{
            fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 5,
            background: "linear-gradient(135deg,#8B5CF6,#7C3AED)", color: "#FFF",
          }}>PRO</span>}
        </div>
        {desc && <div style={{ fontFamily: "'Manrope',sans-serif", fontSize: 11.5, color: "#94A3B8", marginTop: 3 }}>{desc}</div>}
      </div>
      <div onClick={() => onChange(!checked)} style={{
        width: 56, minWidth: 56, height: 30, minHeight: 30, borderRadius: 15, cursor: "pointer",
        background: checked ? "linear-gradient(135deg,#F59E0B,#D97706)" : "#C9CDD4",
        transition: "all 0.4s cubic-bezier(0.4,0,0.2,1)",
        boxShadow: checked
          ? "0 4px 14px rgba(245,158,11,0.4), inset 0 1px 1px rgba(255,255,255,0.15)"
          : "inset 0 2px 4px rgba(0,0,0,0.12), inset 0 0 0 1px rgba(0,0,0,0.04)",
        flexShrink: 0, position: "relative",
      }}>
        <div style={{
          width: 24, height: 24, borderRadius: 12, background: "#FFF",
          boxShadow: "0 2px 6px rgba(0,0,0,0.2), 0 0 0 0.5px rgba(0,0,0,0.04)",
          position: "absolute", top: 3, left: checked ? 29 : 3,
          transition: "left 0.4s cubic-bezier(0.4,0,0.2,1)",
        }} />
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, count, badge, isOpen, onToggle, isNew }) {
  return (
    <div onClick={onToggle} style={{
      display: "flex", alignItems: "center", gap: 12, padding: "14px 20px",
      cursor: "pointer", userSelect: "none",
      background: isOpen ? "linear-gradient(135deg,#FFFBF0,#FEF3E2)" : "transparent",
      borderBottom: isOpen ? "1px solid #F3E8D8" : "1px solid transparent",
      transition: "all 0.3s ease",
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
        background: isOpen ? "linear-gradient(135deg,#F59E0B,#D97706)" : "#F8F4EF",
        fontSize: 16, transition: "all 0.35s ease",
        boxShadow: isOpen ? "0 4px 12px rgba(245,158,11,0.25)" : "none",
      }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: "'Satoshi',sans-serif", fontWeight: 700, fontSize: 13.5,
          color: isOpen ? "#92400E" : "#1A1D23", transition: "color 0.3s",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          {title}
          {isNew && <span style={{
            fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
            background: "linear-gradient(135deg,#10B981,#059669)", color: "#FFF",
            animation: "pulse 2s infinite",
          }}>YENİ</span>}
        </div>
      </div>
      {badge && <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: badge==="AI"?"linear-gradient(135deg,#0EA5E9,#6366F1)":"linear-gradient(135deg,#8B5CF6,#7C3AED)", color: "#FFF" }}>{badge}</span>}
      <span style={{ fontFamily: "'Manrope',sans-serif", fontSize: 10, color: "#94A3B8", background: "#F8F4EF", padding: "3px 8px", borderRadius: 6, fontWeight: 600 }}>{count}</span>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round"
        style={{ transition: "transform 0.3s", transform: isOpen ? "rotate(180deg)" : "rotate(0)" }}>
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  );
}

function MiniWidget({ color, dark, gradient }) {
  const bg = gradient || `linear-gradient(135deg,${color},${dark})`;
  return (
    <div style={{ width: "100%", height: 48, borderRadius: 0, overflow: "hidden", background: "#FAFAF8" }}>
      <div style={{ height: 17, background: bg, display: "flex", alignItems: "center", padding: "0 6px", gap: 3 }}>
        <div style={{ width: 7, height: 7, borderRadius: 3, background: "rgba(255,255,255,0.3)" }} />
        <div style={{ height: 3, width: 22, borderRadius: 2, background: "rgba(255,255,255,0.4)" }} />
      </div>
      <div style={{ padding: "4px 6px" }}>
        <div style={{ height: 2.5, width: "60%", borderRadius: 2, background: "#E2E8F0", marginBottom: 3 }} />
        <div style={{ height: 2.5, width: "40%", borderRadius: 2, background: "#F1F5F9", marginBottom: 3 }} />
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div style={{ height: 7, width: 24, borderRadius: 3, background: bg }} />
        </div>
      </div>
    </div>
  );
}

function ProUpgradeModal({ show, onClose, feature, t }) {
  if (!show) return null;
  const _t = t || ((k) => k);
  return (
    <div style={{position:"fixed",inset:0,zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.5)",backdropFilter:"blur(4px)"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#FFF",borderRadius:20,padding:"32px 28px",maxWidth:400,width:"90%",textAlign:"center",animation:"fadeUp 0.3s ease both",boxShadow:"0 24px 64px rgba(0,0,0,0.15)"}}>
        <div style={{width:56,height:56,borderRadius:16,background:"linear-gradient(135deg,#8B5CF6,#7C3AED)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",fontSize:24}}>👑</div>
        <h3 style={{fontFamily:"'Satoshi',sans-serif",fontSize:20,fontWeight:800,color:"#1A1D23",margin:"0 0 8px"}}>{_t("wA.modal.proFeature")}</h3>
        <p style={{fontFamily:"'Manrope',sans-serif",fontSize:13,color:"#64748B",lineHeight:1.6,margin:"0 0 20px"}}><strong>{feature}</strong> {_t("wA.modal.upgradeMsg")}</p>
        <div style={{display:"flex",gap:8}}>
          <button onClick={onClose} style={{flex:1,padding:"11px",borderRadius:10,border:"1px solid #E2E8F0",background:"#FFF",fontFamily:"'Manrope',sans-serif",fontSize:13,fontWeight:600,color:"#64748B",cursor:"pointer"}}>{_t("wA.modal.cancel")}</button>
          <button onClick={()=>{ window.location.href="/portal/pricing"; }} style={{flex:1,padding:"11px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#8B5CF6,#7C3AED)",fontFamily:"'Satoshi',sans-serif",fontSize:13,fontWeight:700,color:"#FFF",cursor:"pointer",boxShadow:"0 4px 12px rgba(139,92,246,0.3)"}}>{_t("wA.modal.upgrade")}</button>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ isAgent, text, color, dark, avatar }) {
  return (
    <div style={{ display: "flex", justifyContent: isAgent ? "flex-end" : "flex-start", marginBottom: 7 }}>
      {!isAgent && <div style={{ width: 26, height: 26, borderRadius: 8, background: "#E2E8F0", marginRight: 6, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>👤</div>}
      <div style={{
        maxWidth: "80%", padding: "8px 12px", borderRadius: isAgent ? "12px 12px 3px 12px" : "12px 12px 12px 3px",
        background: isAgent ? `linear-gradient(135deg,${color},${dark})` : "#F3F4F6",
        color: isAgent ? "#FFF" : "#1A1D23",
        fontFamily: "'Manrope',sans-serif", fontSize: 12.5, lineHeight: 1.45,
      }}>{text}</div>
      {isAgent && <div style={{ width: 26, height: 26, borderRadius: 8, background: `linear-gradient(135deg,${color},${dark})`, marginLeft: 6, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>{avatar}</div>}
    </div>
  );
}

// ════ MAIN ════
export default function WidgetAppearanceUltimateV2({ planKey = "free", onSave, loading: externalLoading = false, initialSettings, settingsVersion = 0, orgKey = "" }) {
  const { t: _t } = useI18n();

  // ── Translated display names for constant arrays ──
  const themeName = useMemo(() => ({ amber:"Amber", ocean:_t("wA.theme.ocean"), emerald:_t("wA.theme.emerald"), violet:_t("wA.theme.violet"), rose:_t("wA.theme.rose"), slate:_t("wA.theme.slate"), teal:_t("wA.theme.teal"), indigo:_t("wA.theme.indigo"), sunset:_t("wA.theme.sunset"), aurora:"Aurora", midnight:_t("wA.theme.midnight"), cherry:_t("wA.theme.cherry") }), [_t]);
  const launcherName = useMemo(() => ({ rounded:_t("wA.launcher.rounded"), squircle:_t("wA.launcher.squircle"), pill:_t("wA.launcher.pill"), bar:_t("wA.launcher.bar") }), [_t]);
  const posLabel = useMemo(() => ({ br:_t("wA.pos.br"), bl:_t("wA.pos.bl") }), [_t]);
  const pvLabel = useMemo(() => ({ launcher:_t("wA.pv.launcher"), home:_t("wA.pv.home"), chat:_t("wA.pv.chat"), prechat:_t("wA.pv.prechat"), offline:_t("wA.pv.offline") }), [_t]);
  const sizeLabel = useMemo(() => ({ compact:_t("wA.size.compact"), standard:_t("wA.size.standard"), large:_t("wA.size.large") }), [_t]);
  const bgName = useMemo(() => ({ none:_t("wA.bg.none"), dots:_t("wA.bg.dots"), lines:_t("wA.bg.lines"), grid:_t("wA.bg.grid"), waves:_t("wA.bg.waves"), diamonds:_t("wA.bg.diamonds"), circles:_t("wA.bg.circles"), confetti:_t("wA.bg.confetti") }), [_t]);
  const attLabel = useMemo(() => ({ none:_t("wA.att.none"), wave:_t("wA.att.wave"), message:_t("wA.att.message"), bounce:_t("wA.att.bounce"), pulse:_t("wA.att.pulse") }), [_t]);
  const daysLabel = useMemo(() => [_t("wA.day.mon"),_t("wA.day.tue"),_t("wA.day.wed"),_t("wA.day.thu"),_t("wA.day.fri"),_t("wA.day.sat"),_t("wA.day.sun")], [_t]);

  const [theme, setTheme] = useState(THEMES[0]);
  const [customColor, setCustomColor] = useState("#F59E0B");
  const [useCustom, setUseCustom] = useState(false);
  const [launcher, setLauncher] = useState(LAUNCHERS[0]);
  const [position, setPosition] = useState(POSITIONS[0]);
  const [previewState, setPreviewState] = useState(PREVIEW_STATES[1]);
  const [widgetSize, setWidgetSize] = useState(SIZES[1]);
  const [openSection, setOpenSection] = useState(0);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [devicePreview, setDevicePreview] = useState("desktop"); // desktop | mobile

  // Content
  const [headerText, setHeaderText] = useState("Nasıl yardımcı olabiliriz?");
  const [subText, setSubText] = useState("Genellikle birkaç dakika içinde yanıt veriyoruz");
  const [welcomeMsg, setWelcomeMsg] = useState("Merhaba! 👋 Size nasıl yardımcı olabilirim?");
  const [offlineMsg, setOfflineMsg] = useState("Şu an çevrimdışıyız. Mesajınızı bırakın, en kısa sürede dönelim.");
  const [launcherLabel, setLauncherLabel] = useState("Bize yazın");

  // Conversation Starters
  const [starters, setStarters] = useState([
    { id: 1, text: "💰 Fiyatlandırma hakkında bilgi", active: true },
    { id: 2, text: "🛠️ Teknik destek istiyorum", active: true },
    { id: 3, text: "📦 Siparişimi takip etmek istiyorum", active: true },
    { id: 4, text: "🤝 Demo talep etmek istiyorum", active: false },
  ]);
  const [newStarter, setNewStarter] = useState("");

  // Avatars
  const [botAvatar, setBotAvatar] = useState("🤖");
  const [agentAvatar, setAgentAvatar] = useState("👩‍💼");
  const [agentImage, setAgentImage] = useState(null);
  const [agentImagePreview, setAgentImagePreview] = useState(null);
  const agentImgRef = useRef(null);

  // Background pattern
  const [bgPattern, setBgPattern] = useState(BACKGROUNDS[0]);

  // Attention Grabber
  const [attGrabber, setAttGrabber] = useState(ATTENTION_GRABBERS[0]);
  const [attGrabberText, setAttGrabberText] = useState("Merhaba! Yardıma ihtiyacınız var mı? 👋");
  const [attGrabberDelay, setAttGrabberDelay] = useState(5);

  // Operating Hours
  const [hoursEnabled, setHoursEnabled] = useState(true);
  const [timezone, setTimezone] = useState("Europe/Istanbul");
  const [hours, setHours] = useState(DAYS_TR.map((d, i) => ({ day: d, on: i < 5, start: "09:00", end: "18:00" })));

  // Toggles
  const [showBranding, setShowBranding] = useState(true);
  const [showOnMobile, setShowOnMobile] = useState(true);
  const [showOffline, setShowOffline] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoOpen, setAutoOpen] = useState(false);
  const [showUnread, setShowUnread] = useState(true);
  const [preChatEnabled, setPreChatEnabled] = useState(false);
  const [typingIndicator, setTypingIndicator] = useState(true);
  const [fileUpload, setFileUpload] = useState(true);
  const [emojiPicker, setEmojiPicker] = useState(true);
  const [readReceipts, setReadReceipts] = useState(true);

  // AI Persona
  const [aiName, setAiName] = useState("Helvion AI");
  const [aiTone, setAiTone] = useState("friendly");
  const [aiLength, setAiLength] = useState("standard");
  const [aiEmoji, setAiEmoji] = useState(true);
  const [aiLabel, setAiLabel] = useState(true);
  const [aiWelcome, setAiWelcome] = useState("Merhaba! Ben Helvion AI asistanınız 🤖 Size nasıl yardımcı olabilirim?");
  const [aiModel, setAiModel] = useState("auto");
  const [aiSuggestions, setAiSuggestions] = useState(true);

  const AI_TONES = [
    { id: "friendly", label: _t("wA.aiTone.friendly"), emoji: "😊", desc: _t("wA.aiTone.friendlyDesc") },
    { id: "professional", label: _t("wA.aiTone.professional"), emoji: "👔", desc: _t("wA.aiTone.professionalDesc") },
    { id: "neutral", label: _t("wA.aiTone.neutral"), emoji: "⚖️", desc: _t("wA.aiTone.neutralDesc") },
    { id: "humorous", label: _t("wA.aiTone.humorous"), emoji: "😄", desc: _t("wA.aiTone.humorousDesc") },
  ];
  const AI_LENGTHS = [
    { id: "concise", label: _t("wA.aiLen.concise"), desc: _t("wA.aiLen.conciseDesc") },
    { id: "standard", label: _t("wA.aiLen.standard"), desc: _t("wA.aiLen.standardDesc") },
    { id: "thorough", label: _t("wA.aiLen.thorough"), desc: _t("wA.aiLen.thoroughDesc") },
  ];
  const AI_MODELS = [
    { id: "auto", label: _t("wA.aiModel.auto"), desc: _t("wA.aiModel.autoDesc") },
    { id: "fast", label: _t("wA.aiModel.fast"), desc: _t("wA.aiModel.fastDesc") },
    { id: "balanced", label: _t("wA.aiModel.balanced"), desc: _t("wA.aiModel.balancedDesc") },
    { id: "quality", label: _t("wA.aiModel.quality"), desc: _t("wA.aiModel.qualityDesc") },
  ];

  // Embed code
  const [showEmbed, setShowEmbed] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  const [proModal, setProModal] = useState({ show: false, feature: "" });
  const [toast, setToast] = useState(null);
  const showToast = useCallback((msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); }, []);
  const [dragIdx, setDragIdx] = useState(null);
  const logoRef = useRef(null);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);

  // PRO Features
  const [csat, setCsat] = useState(false);
  const [whiteLabel, setWhiteLabel] = useState(false);
  const [autoReply, setAutoReply] = useState(false);
  const [autoReplyMsg, setAutoReplyMsg] = useState("Mesajınız alındı! En kısa sürede dönüş yapacağız.");
  const [customCss, setCustomCss] = useState("");
  const [consentEnabled, setConsentEnabled] = useState(false);
  const [consentText, setConsentText] = useState("Sohbet başlayarak gizlilik politikamızı kabul edersiniz.");
  const [pageRules, setPageRules] = useState([{ id:1, url:"/pricing", action:"show" }]);
  const [newPageUrl, setNewPageUrl] = useState("");
  const [newPageAction, setNewPageAction] = useState("show");
  const [linkCopied, setLinkCopied] = useState(false);
  const [responseTime, setResponseTime] = useState(true);
  const [transcriptEmail, setTranscriptEmail] = useState(false);
  const [visitorNotes, setVisitorNotes] = useState(true);
  const isPro = planKey === "pro" || planKey === "business" || planKey === "enterprise";
  const isStarter = planKey === "starter" || isPro;
  const isFree = planKey === "free";
  const showUpgrade = (feat) => setProModal({ show: true, feature: feat });

  const ac = useCustom ? customColor : theme.color;
  const ad = useCustom ? customColor : theme.dark;
  const al = useCustom ? customColor + "15" : theme.light;
  const ag = useCustom ? `linear-gradient(135deg,${customColor},${customColor})` : (theme.gradient || `linear-gradient(135deg,${theme.color},${theme.dark})`);
  const hexRgb = (hex) => {
    const h = hex.replace('#','');
    return `${parseInt(h.substring(0,2),16)},${parseInt(h.substring(2,4),16)},${parseInt(h.substring(4,6),16)}`;
  };
  const acRgb = hexRgb(ac);
  const adRgb = hexRgb(ad);
  // Hydration version tracking — ensures we hydrate once per API fetch
  const lastHydratedVersionRef = useRef(0);

  // Hydrate ALL component states from API settings
  // Fires when settingsVersion changes (meaning page.tsx fetched fresh data from API)
  useEffect(() => {
    // Guard: skip if no data, or if we already hydrated this version
    if (!initialSettings || settingsVersion === 0) return;
    if (lastHydratedVersionRef.current >= settingsVersion) return;
    lastHydratedVersionRef.current = settingsVersion;

    const s2 = initialSettings;
    // Theme
    if (s2.themeId) { const found = THEMES.find(th => th.id === s2.themeId); if (found) setTheme(found); }
    if (s2.customColor) setCustomColor(s2.customColor);
    if (typeof s2.useCustomColor === "boolean") setUseCustom(s2.useCustomColor);
    // Launcher / Position / Size
    if (s2.launcherId) { const found = LAUNCHERS.find(l => l.id === s2.launcherId); if (found) setLauncher(found); }
    if (s2.positionId) { const found = POSITIONS.find(p => p.id === s2.positionId); if (found) setPosition(found); }
    if (s2.widgetSizeId) { const found = SIZES.find(sz => sz.id === s2.widgetSizeId); if (found) setWidgetSize(found); }
    // Text content
    if (s2.headerText != null) setHeaderText(s2.headerText);
    if (s2.subText != null) setSubText(s2.subText);
    if (s2.welcomeMsg != null) setWelcomeMsg(s2.welcomeMsg);
    if (s2.offlineMsg != null) setOfflineMsg(s2.offlineMsg);
    if (s2.launcherLabel != null) setLauncherLabel(s2.launcherLabel);
    // Starters & Avatars
    if (Array.isArray(s2.starters)) setStarters(s2.starters);
    if (s2.botAvatar != null) setBotAvatar(s2.botAvatar);
    if (s2.agentAvatar != null) setAgentAvatar(s2.agentAvatar);
    // Background & Attention
    if (s2.bgPatternId) { const found = BACKGROUNDS.find(b => b.id === s2.bgPatternId); if (found) setBgPattern(found); }
    if (s2.attGrabberId) { const found = ATTENTION_GRABBERS.find(a => a.id === s2.attGrabberId); if (found) setAttGrabber(found); }
    if (s2.attGrabberText != null) setAttGrabberText(s2.attGrabberText);
    if (typeof s2.attGrabberDelay === "number") setAttGrabberDelay(s2.attGrabberDelay);
    // Operating hours
    if (typeof s2.hoursEnabled === "boolean") setHoursEnabled(s2.hoursEnabled);
    if (s2.timezone) setTimezone(s2.timezone);
    if (Array.isArray(s2.hours)) setHours(s2.hours);
    // Toggles
    if (typeof s2.showBranding === "boolean") setShowBranding(s2.showBranding);
    if (typeof s2.showOnMobile === "boolean") setShowOnMobile(s2.showOnMobile);
    if (typeof s2.showOffline === "boolean") setShowOffline(s2.showOffline);
    if (typeof s2.soundEnabled === "boolean") setSoundEnabled(s2.soundEnabled);
    if (typeof s2.autoOpen === "boolean") setAutoOpen(s2.autoOpen);
    if (typeof s2.showUnread === "boolean") setShowUnread(s2.showUnread);
    if (typeof s2.preChatEnabled === "boolean") setPreChatEnabled(s2.preChatEnabled);
    if (typeof s2.typingIndicator === "boolean") setTypingIndicator(s2.typingIndicator);
    if (typeof s2.fileUpload === "boolean") setFileUpload(s2.fileUpload);
    if (typeof s2.emojiPicker === "boolean") setEmojiPicker(s2.emojiPicker);
    if (typeof s2.readReceipts === "boolean") setReadReceipts(s2.readReceipts);
    if (typeof s2.responseTime === "boolean") setResponseTime(s2.responseTime);
    if (typeof s2.transcriptEmail === "boolean") setTranscriptEmail(s2.transcriptEmail);
    if (typeof s2.visitorNotes === "boolean") setVisitorNotes(s2.visitorNotes);
    // AI
    if (s2.aiName != null) setAiName(s2.aiName);
    if (s2.aiTone) setAiTone(s2.aiTone);
    if (s2.aiLength) setAiLength(s2.aiLength);
    if (typeof s2.aiEmoji === "boolean") setAiEmoji(s2.aiEmoji);
    if (typeof s2.aiLabel === "boolean") setAiLabel(s2.aiLabel);
    if (s2.aiWelcome != null) setAiWelcome(s2.aiWelcome);
    if (s2.aiModel) setAiModel(s2.aiModel);
    if (typeof s2.aiSuggestions === "boolean") setAiSuggestions(s2.aiSuggestions);
    // PRO features
    if (typeof s2.csat === "boolean") setCsat(s2.csat);
    if (typeof s2.whiteLabel === "boolean") setWhiteLabel(s2.whiteLabel);
    if (typeof s2.autoReply === "boolean") setAutoReply(s2.autoReply);
    if (s2.autoReplyMsg != null) setAutoReplyMsg(s2.autoReplyMsg);
    if (s2.customCss != null) setCustomCss(s2.customCss);
    if (typeof s2.consentEnabled === "boolean") setConsentEnabled(s2.consentEnabled);
    if (s2.consentText != null) setConsentText(s2.consentText);
    if (Array.isArray(s2.pageRules)) setPageRules(s2.pageRules);
  }, [initialSettings, settingsVersion]);

  const markChanged = useCallback(() => { setHasChanges(true); setSaved(false); }, []);

  const handleSave = async () => {
    const selectedThemeIsPremium = Boolean(theme?.pro);
    if (isFree && selectedThemeIsPremium) {
      showUpgrade(`${theme.name} Tema`);
      return;
    }
    // Derive the effective primary color for legacy widget compatibility
    const effectiveColor = useCustom ? customColor : theme.color;
    // Map v3 positionId to legacy position value
    const legacyPosition = position.id === "bl" ? "left" : "right";

    const payloadSettings = {
      // ── Legacy fields (used by embedded widget via bootloader) ──
      primaryColor: effectiveColor,
      position: legacyPosition,
      launcher: launcher.id === "pill" || launcher.id === "bar" ? "bubble" : "bubble",
      welcomeTitle: headerText,
      welcomeMessage: welcomeMsg,
      // ── v3-ultimate fields (stored in configJson) ──
      themeId: theme.id,
      customColor,
      useCustomColor: useCustom,
      launcherId: launcher.id,
      positionId: position.id,
      widgetSizeId: widgetSize.id,
      headerText,
      subText,
      welcomeMsg,
      offlineMsg,
      launcherLabel,
      starters,
      botAvatar,
      agentAvatar,
      bgPatternId: bgPattern.id,
      attGrabberId: attGrabber.id,
      attGrabberText,
      attGrabberDelay,
      hoursEnabled,
      timezone,
      hours,
      showBranding,
      showOnMobile,
      showOffline,
      soundEnabled,
      autoOpen,
      showUnread,
      preChatEnabled,
      typingIndicator,
      fileUpload,
      emojiPicker,
      readReceipts,
      responseTime,
      transcriptEmail,
      visitorNotes,
      aiName,
      aiTone,
      aiLength,
      aiEmoji,
      aiLabel,
      aiWelcome,
      aiModel,
      aiSuggestions,
      csat,
      whiteLabel,
      autoReply,
      autoReplyMsg,
      customCss,
      consentEnabled,
      consentText,
      pageRules,
    };

    if (!isPro) {
      payloadSettings.aiModel = "auto";
      payloadSettings.csat = false;
      payloadSettings.whiteLabel = false;
      payloadSettings.autoReply = false;
      payloadSettings.consentEnabled = false;
      payloadSettings.customCss = "";
      payloadSettings.transcriptEmail = false;
      payloadSettings.showBranding = true;
      payloadSettings.preChatEnabled = false;
      payloadSettings.pageRules = [];
    }
    if (isFree) {
      const premiumThemes = new Set(["sunset", "aurora", "midnight", "cherry"]);
      const premiumPatterns = new Set(["diamonds", "circles", "confetti"]);
      if (premiumThemes.has(payloadSettings.themeId)) payloadSettings.themeId = "amber";
      if (premiumPatterns.has(payloadSettings.bgPatternId)) payloadSettings.bgPatternId = "none";
    }

    setSaving(true);
    try {
      if (typeof onSave === "function") {
        await onSave(payloadSettings);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
      setSaved(true);
      setHasChanges(false);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      // Bubble up the actual API error message when possible.
      const msg =
        err && typeof err === "object" && "message" in err && typeof err.message === "string"
          ? err.message
          : null;
      showToast(msg || _t("wA.error.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  // REAL logo upload
  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2*1024*1024) { showToast(_t("wA.error.fileTooLarge")); return; }
    if (!['image/png','image/jpeg','image/svg+xml','image/webp'].includes(file.type)) { showToast(_t("wA.error.invalidFormat")); return; }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target.result);
    reader.readAsDataURL(file);
    markChanged();
  };
  const removeLogo = () => { setLogoFile(null); setLogoPreview(null); if(logoRef.current) logoRef.current.value=""; markChanged(); };
  const handleAgentImageUpload = (e) => {
    const file = e.target.files?.[0]; if(!file) return;
    if(file.size>2*1024*1024){showToast(_t("wA.error.fileTooLarge"));return;}
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)){showToast(_t("wA.error.invalidFormatAgent"));return;}
    setAgentImage(file);
    const reader = new FileReader();
    reader.onload = (ev) => {setAgentImagePreview(ev.target.result);setAgentAvatar(null);};
    reader.readAsDataURL(file); markChanged();
  };
  const removeAgentImage = () => { setAgentImage(null); setAgentImagePreview(null); setAgentAvatar("👩‍💼"); if(agentImgRef.current) agentImgRef.current.value=""; markChanged(); };

  // REAL drag reorder
  const handleDragStart = (i) => setDragIdx(i);
  const handleDragOver = (e,i) => { e.preventDefault(); if(dragIdx===null||dragIdx===i) return; setStarters(p=>{const n=[...p];const item=n.splice(dragIdx,1)[0];n.splice(i,0,item);return n;}); setDragIdx(i); };
  const handleDragEnd = () => { setDragIdx(null); markChanged(); };

  // Page rules
  const addPageRule = () => { if(!newPageUrl.trim()) return; setPageRules(p=>[...p,{id:Date.now(),url:newPageUrl.trim(),action:newPageAction}]); setNewPageUrl(""); markChanged(); };
  const removePageRule = (id) => { setPageRules(p=>p.filter(r=>r.id!==id)); markChanged(); };

  // Copy handlers
  const orgKeyDisplay = orgKey || "YOUR_ORG_KEY";
  const embedCode = `<script src="https://api.helvion.io/embed.js" data-org="${orgKeyDisplay}" async><\/script>`;
  const directChatLink = `https://helvion.io/chat/${orgKeyDisplay}`;
  const copyEmbed = () => { navigator.clipboard?.writeText(embedCode).then(()=>{setEmbedCopied(true);setTimeout(()=>setEmbedCopied(false),2000);}); };
  const copyLink = () => { navigator.clipboard?.writeText(directChatLink).then(()=>{setLinkCopied(true);setTimeout(()=>setLinkCopied(false),2000);}); };

  const tog = (i) => setOpenSection(openSection === i ? -1 : i);

  const addStarter = () => {
    if (!newStarter.trim()) return;
    setStarters(p => [...p, { id: Date.now(), text: newStarter, active: true }]);
    setNewStarter("");
    markChanged();
  };

  const toggleStarter = (id) => {
    setStarters(p => p.map(s => s.id === id ? { ...s, active: !s.active } : s));
    markChanged();
  };

  const removeStarter = (id) => {
    setStarters(p => p.filter(s => s.id !== id));
    markChanged();
  };

  const toggleDay = (i) => {
    setHours(p => p.map((h, idx) => idx === i ? { ...h, on: !h.on } : h));
    markChanged();
  };

  const updateHour = (i, field, val) => {
    setHours(p => p.map((h, idx) => idx === i ? { ...h, [field]: val } : h));
    markChanged();
  };
  const applyToAll = () => { const first = hours.find(h=>h.on); if(!first) return; setHours(p=>p.map(h=>h.on?{...h,start:first.start,end:first.end}:h)); markChanged(); };

  // CSS var
  const s = {
    font: "'Manrope',sans-serif",
    fontH: "'Satoshi',sans-serif",
    fontMono: "'JetBrains Mono',monospace",
    bg: "#FAF9F7",
    card: "#FFF",
    border: "1px solid rgba(0,0,0,0.05)",
    borderFocus: `1.5px solid ${ac}`,
    inputBg: "#FFFCF8",
    inputBorder: "1.5px solid #E8E0D4",
    label: { fontFamily: "'Manrope',sans-serif", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6, display: "block" },
    input: {
      width: "100%", padding: "9px 13px", borderRadius: 10, border: "1.5px solid #E8E0D4",
      fontFamily: "'Manrope',sans-serif", fontSize: 13, color: "#1A1D23", outline: "none",
      background: "#FFFCF8", transition: "border 0.2s",
    },
  };

  if (externalLoading) {
    return (
      <div style={{ fontFamily: "'Manrope',sans-serif", background: "#FAF9F7", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
        <link href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,600,700,800&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
        <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
        <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid #F3E8D8", borderTopColor: "#F59E0B", animation: "spin 0.8s linear infinite" }} />
        <div style={{ fontFamily: "'Satoshi',sans-serif", fontSize: 14, fontWeight: 700, color: "#92400E" }}>{t("wA.loading")}</div>
        <div style={{ fontFamily: "'Manrope',sans-serif", fontSize: 11, color: "#94A3B8" }}>{t("wA.pleaseWait")}</div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: s.font, background: s.bg, minHeight: "100vh" }}>
      <link href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,600,700,800&display=swap" rel="stylesheet" />
      <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
        @keyframes saveCheck{from{transform:scale(0) rotate(-45deg)}to{transform:scale(1) rotate(0)}}
        @keyframes dotPulse{0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,0.4)}50%{box-shadow:0 0 0 5px rgba(16,185,129,0)}}
        @keyframes gentleBob{0%,100%{transform:translateY(0) rotateX(0deg) rotateY(0deg)}25%{transform:translateY(-5px) rotateX(2deg) rotateY(-1.5deg)}50%{transform:translateY(-9px) rotateX(0deg) rotateY(1.5deg)}75%{transform:translateY(-3px) rotateX(-1.5deg) rotateY(0deg)}}
        @keyframes widgetFloat{0%{transform:translateY(0) rotateX(0deg) rotateY(0deg) scale(1)}20%{transform:translateY(-7px) rotateX(2.5deg) rotateY(-2deg) scale(1.008)}50%{transform:translateY(-12px) rotateX(-1.5deg) rotateY(2.5deg) scale(1.015)}70%{transform:translateY(-5px) rotateX(2deg) rotateY(-1deg) scale(1.005)}100%{transform:translateY(0) rotateX(0deg) rotateY(0deg) scale(1)}}
        @keyframes attBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        @keyframes attPulse{0%,100%{box-shadow:0 0 0 0 var(--att-color)}50%{box-shadow:0 0 0 12px transparent}}
        @keyframes shake{0%,100%{transform:rotate(0)}25%{transform:rotate(-8deg)}75%{transform:rotate(8deg)}}
        @keyframes slideIn{from{opacity:0;transform:translateY(8px) scale(0.96)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes ripple{0%{transform:scale(1);opacity:0.4}100%{transform:scale(2.5);opacity:0}}
        @keyframes meshFloat1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-20px,15px) scale(1.1)}}
        @keyframes meshFloat2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(15px,-20px) scale(1.15)}}
        @keyframes meshFloat3{0%,100%{transform:translate(0,0) scale(0.9)}50%{transform:translate(-10px,10px) scale(1.05)}}
        @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#E2E8F0;border-radius:10px}
        ::-webkit-scrollbar-thumb:hover{background:#CBD5E1}
      `}</style>

      <ProUpgradeModal show={proModal.show} onClose={()=>setProModal({show:false,feature:""})} feature={proModal.feature} t={t} />

      {/* Toast Notification */}
      {toast && (
        <div style={{ position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)", zIndex:9999, background:"#1A1D23", color:"#FFF", padding:"10px 20px", borderRadius:12, fontFamily:"'Manrope',sans-serif", fontSize:13, fontWeight:600, boxShadow:"0 8px 32px rgba(0,0,0,0.2)", animation:"fadeUp 0.3s ease both" }}>
          {toast}
        </div>
      )}

      {/* ═══ HEADER ═══ */}
      <div style={{
        padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid #F3E8D8", background: "#FFFCF8", animation: "fadeUp 0.4s ease both",
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: "#94A3B8" }}>{t("wA.breadcrumb.settings")}</span>
            <span style={{ color: "#CBD5E1", fontSize: 10 }}>/</span>
            <span style={{ fontSize: 11, color: ac, fontWeight: 600 }}>{t("wA.title")}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontFamily: s.fontH, fontSize: 22, fontWeight: 800, color: "#1A1D23", margin: 0 }}>{t("wA.title")}</h1>
            <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 7, background: "linear-gradient(135deg,#FEF3C7,#FDE68A)", color: "#92400E" }}>{t("wA.sectionsCount")}</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 7, background: "linear-gradient(135deg,#EDE9FE,#DDD6FE)", color: "#7C3AED" }}>{t("wA.settingsCount")}</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {hasChanges && (
            <div style={{ fontSize: 11, color: "#F59E0B", fontWeight: 600, display: "flex", alignItems: "center", gap: 5, animation: "fadeUp 0.3s ease both" }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#F59E0B", animation: "pulse 1.5s infinite" }} />
              {t("wA.unsaved")}
            </div>
          )}
          <button onClick={() => setShowEmbed(!showEmbed)} style={{
            padding: "8px 14px", borderRadius: 9, border: "1px solid #E2E8F0",
            background: showEmbed ? al : "#FFF", fontFamily: s.font, fontSize: 12, fontWeight: 600,
            color: showEmbed ? ac : "#64748B", cursor: "pointer", transition: "all 0.2s",
          }}>{"</>"} {t("wA.embedCode")}</button>
          <button onClick={handleSave} disabled={saving} style={{
            fontFamily: s.fontH, fontSize: 13, fontWeight: 700,
            padding: "9px 20px", borderRadius: 10, border: "none",
            background: saved ? "linear-gradient(135deg,#10B981,#059669)" : "linear-gradient(135deg,#F59E0B,#D97706)",
            color: "#FFF", cursor: saving ? "wait" : "pointer",
            boxShadow: saved ? "0 4px 14px rgba(16,185,129,0.3)" : "0 4px 14px rgba(245,158,11,0.3)",
            transition: "all 0.4s", display: "flex", alignItems: "center", gap: 6, minWidth: 145,
          }}>
            {saving ? (<><div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid #FFF", borderRadius: "50%", animation: "pulse 0.8s linear infinite" }}/> {_t("wA.saving")}</>)
            : saved ? (<><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" style={{animation:"saveCheck 0.4s ease both"}}><polyline points="20 6 9 17 4 12"/></svg> {_t("wA.saved")}</>)
            : (<>✓ {_t("wA.save")}</>)}
          </button>
        </div>
      </div>

      {/* Embed Code Bar */}
      {showEmbed && (
        <div style={{ padding: "12px 28px", background: "#1E293B", animation: "slideIn 0.3s ease both", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: "#94A3B8", fontWeight: 600, whiteSpace: "nowrap" }}>Embed:</span>
          <code style={{ fontFamily: s.fontMono, fontSize: 11, color: "#38BDF8", background: "#0F172A", padding: "6px 12px", borderRadius: 8, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {embedCode.replace("<\\/script>", "</script>")}
          </code>
          <button onClick={copyEmbed}
            style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid #334155", background: embedCopied ? "#10B981" : "#334155", color: "#FFF", fontFamily: s.font, fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.3s" }}>
            {embedCopied ? _t("wA.copied") : _t("wA.copy")}
          </button>
        </div>
      )}

      {/* ═══ GRID ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: 0, minHeight: "calc(100vh - 80px)" }}>

        {/* ═══ LEFT — SETTINGS ═══ */}
        <div style={{ padding: "20px 24px", overflowY: "auto", maxHeight: "calc(100vh - 80px)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, animation: "fadeUp 0.5s ease both", animationDelay: "0.1s" }}>

            {/* 1. TEMA */}
            <div style={{ background: s.card, borderRadius: 14, overflow: "hidden", border: s.border }}>
              <SectionHeader icon="🎨" title={_t("wA.sec.themes")} count={THEMES.length + 1} isOpen={openSection===0} onToggle={()=>tog(0)} />
              {openSection===0 && (
                <div style={{ padding: 18, animation: "fadeUp 0.3s ease both" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginBottom: 14 }}>
                    {THEMES.map((t,i) => {
                      const sel = theme.id===t.id && !useCustom;
                      const isPremium = t.pro;
                      return (
                        <div key={t.id} onClick={()=>{if(isPremium && isFree){showUpgrade(t.name+" Tema");return;}setTheme(t);setUseCustom(false);markChanged();}}
                          style={{ borderRadius: 10, overflow: "hidden", cursor: "pointer", border: "none", boxShadow: sel?`0 0 0 2.5px ${t.color}, 0 6px 16px ${t.color}30`:"0 1px 4px rgba(0,0,0,0.06)", transition: "all 0.3s ease", background: sel?t.light:"#FAFAF8", position: "relative", opacity: isPremium && !isPro ? 0.7 : 1, transform: sel?"translateY(-2px)":"translateY(0)" }}>
                          {isPremium && !isPro && <div style={{ position: "absolute", top: 3, right: 3, zIndex: 2, fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: "linear-gradient(135deg,#8B5CF6,#7C3AED)", color: "#FFF" }}>PRO</div>}
                          <MiniWidget color={t.color} dark={t.dark} gradient={t.gradient} />
                          <div style={{ padding: "4px 6px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                              <div style={{ width: 9, height: 9, borderRadius: 3, background: t.gradient || `linear-gradient(135deg,${t.color},${t.dark})` }} />
                              <span style={{ fontFamily: s.fontH, fontSize: 9.5, fontWeight: 700, color: sel?t.color:"#475569" }}>{t.name}</span>
                            </div>
                            {sel && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={t.color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Custom */}
                  <div onClick={()=>{setUseCustom(true);markChanged();}} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10,
                    background: useCustom?"#FFFBF0":"#FAFAF8", border: useCustom?`1.5px solid ${ac}`:"1.5px solid transparent", cursor: "pointer", transition: "all 0.3s",
                  }}>
                    <div style={{ position: "relative", width: 32, height: 32 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: `conic-gradient(from 0deg,#F43F5E,#F59E0B,#10B981,#0EA5E9,#8B5CF6,#F43F5E)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ width: 14, height: 14, borderRadius: 4, background: customColor, border: "2px solid white" }} />
                      </div>
                      <input type="color" value={customColor} onChange={e=>{setCustomColor(e.target.value);setUseCustom(true);markChanged();}} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
                    </div>
                    <div>
                      <div style={{ fontFamily: s.fontH, fontSize: 12, fontWeight: 700, color: "#1A1D23" }}>Özel Renk</div>
                      <div style={{ fontFamily: s.fontMono, fontSize: 10, color: "#94A3B8" }}>{customColor.toUpperCase()}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 2. İÇERİK */}
            <div style={{ background: s.card, borderRadius: 14, overflow: "hidden", border: s.border }}>
              <SectionHeader icon="✏️" title={_t("wA.sec.content")} count={5} isOpen={openSection===1} onToggle={()=>tog(1)} />
              {openSection===1 && (
                <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12, animation: "fadeUp 0.3s ease both" }}>
                  {[
                    {l:"Başlık",v:headerText,fn:setHeaderText},
                    {l:"Alt Yazı",v:subText,fn:setSubText},
                    {l:"Karşılama Mesajı",v:welcomeMsg,fn:setWelcomeMsg,multi:true},
                    {l:"Çevrimdışı Mesaj",v:offlineMsg,fn:setOfflineMsg,multi:true},
                    {l:"Başlatıcı Etiketi",v:launcherLabel,fn:setLauncherLabel},
                  ].map((f,i)=>(
                    <div key={i}>
                      <label style={s.label}>{f.l}</label>
                      {f.multi ? (
                        <textarea value={f.v} onChange={e=>{f.fn(e.target.value);markChanged();}} style={{...s.input,resize:"vertical",minHeight:55}}
                          onFocus={e=>e.target.style.borderColor=ac} onBlur={e=>e.target.style.borderColor="#E8E0D4"} />
                      ) : (
                        <input value={f.v} onChange={e=>{f.fn(e.target.value);markChanged();}} style={s.input}
                          onFocus={e=>e.target.style.borderColor=ac} onBlur={e=>e.target.style.borderColor="#E8E0D4"} />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. CONVERSATION STARTERS 🔥 */}
            <div style={{ background: s.card, borderRadius: 14, overflow: "hidden", border: s.border }}>
              <SectionHeader icon="🚀" title={_t("wA.sec.starters")} count={starters.length} isOpen={openSection===2} onToggle={()=>tog(2)} isNew />
              {openSection===2 && (
                <div style={{ padding: 18, animation: "fadeUp 0.3s ease both" }}>
                  <p style={{ fontSize: 11, color: "#64748B", marginTop: 0, marginBottom: 12, lineHeight: 1.5 }}>
                    Ziyaretçiler bu butonlara tıklayarak hızlıca sohbet başlatabilir. Sürükleyerek sıralayabilirsiniz.
                  </p>
                  {starters.map((st,i) => (
                    <div key={st.id} draggable onDragStart={()=>handleDragStart(i)} onDragOver={e=>handleDragOver(e,i)} onDragEnd={handleDragEnd} style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", marginBottom: 6, borderRadius: 10,
                      background: dragIdx===i ? `rgba(${acRgb},0.07)` : st.active ? `rgba(${acRgb},0.03)` : "#F8F4EF",
                      border: dragIdx===i ? `1.5px dashed ${ac}` : st.active ? `1px solid rgba(${acRgb},0.12)` : "1px solid #F1F5F9",
                      transition: "all 0.25s", cursor: "grab",
                    }}>
                      <span style={{ cursor: "grab", color: "#CBD5E1", fontSize: 12 }}>⋮⋮</span>
                      <span style={{ flex: 1, fontFamily: s.font, fontSize: 12, fontWeight: 500, color: st.active ? "#1A1D23" : "#94A3B8" }}>{st.text}</span>
                      <div onClick={()=>toggleStarter(st.id)} style={{
                        width: 32, height: 18, borderRadius: 9, cursor: "pointer",
                        background: st.active ? `linear-gradient(135deg,${ac},${ad})` : "#E2E8F0", padding: 1.5, transition: "all 0.3s",
                      }}>
                        <div style={{ width: 15, height: 15, borderRadius: 8, background: "#FFF", transform: st.active?"translateX(14px)":"translateX(0)", transition: "transform 0.3s" }} />
                      </div>
                      <span onClick={()=>removeStarter(st.id)} style={{ cursor: "pointer", color: "#CBD5E1", fontSize: 14, padding: "0 2px" }}>×</span>
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                    <input value={newStarter} onChange={e=>setNewStarter(e.target.value)} placeholder="Yeni başlatıcı ekle..." onKeyDown={e=>e.key==="Enter"&&addStarter()}
                      style={{...s.input, flex: 1, padding: "7px 11px", fontSize: 12}} onFocus={e=>e.target.style.borderColor=ac} onBlur={e=>e.target.style.borderColor="#E8E0D4"} />
                    <button onClick={addStarter} style={{
                      padding: "7px 14px", borderRadius: 9, border: "none",
                      background: `linear-gradient(135deg,${ac},${ad})`, color: "#FFF",
                      fontFamily: s.fontH, fontSize: 11, fontWeight: 700, cursor: "pointer",
                    }}>+ Ekle</button>
                  </div>
                </div>
              )}
            </div>

            {/* 4. BAŞLATICI STİLİ */}
            <div style={{ background: s.card, borderRadius: 14, overflow: "hidden", border: s.border }}>
              <SectionHeader icon="💬" title={_t("wA.sec.launcherStyle")} count={4} isOpen={openSection===3} onToggle={()=>tog(3)} />
              {openSection===3 && (
                <div style={{ padding: 18, animation: "fadeUp 0.3s ease both" }}>
                  <label style={{...s.label, marginBottom: 8}}>Şekil</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 7, marginBottom: 16 }}>
                    {LAUNCHERS.map(l=>{
                      const sel=launcher.id===l.id;
                      return(
                        <div key={l.id} onClick={()=>{setLauncher(l);markChanged();}} style={{
                          padding: "12px 6px", borderRadius: 10, cursor: "pointer", textAlign: "center",
                          border: sel?`2px solid ${ac}`:"2px solid #F1F5F9", background: sel?`rgba(${acRgb},0.04)`:"#FAFAF8", transition: "all 0.25s",
                        }}>
                          <div style={{ width: Math.min(l.w*0.55,46), height: Math.min(l.h*0.55,30), borderRadius: l.radius, margin: "0 auto 6px", background: `linear-gradient(135deg,${ac},${ad})`, display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                            {l.hasText && <span style={{fontSize:7,color:"#FFF",fontWeight:700}}>Aa</span>}
                          </div>
                          <div style={{ fontFamily: s.font, fontSize: 10, fontWeight: 600, color: sel?ac:"#64748B" }}>{l.name}</div>
                        </div>
                      );
                    })}
                  </div>
                  <label style={{...s.label,marginBottom:8}}>Konum</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {POSITIONS.map(p=>{
                      const sel=position.id===p.id;
                      return(
                        <div key={p.id} onClick={()=>{setPosition(p);markChanged();}} style={{
                          flex:1, padding: "10px", borderRadius: 10, cursor: "pointer", textAlign: "center",
                          border: sel?`2px solid ${ac}`:"2px solid #F1F5F9", background: sel?`rgba(${acRgb},0.04)`:"#FAFAF8", transition: "all 0.25s",
                        }}>
                          <div style={{ width: 44, height: 32, borderRadius: 6, margin: "0 auto 6px", border: "1.5px solid #E2E8F0", position: "relative" }}>
                            <div style={{
                              position: "absolute", [p.x]: 3, bottom: 3,
                              width: 8, height: 8, borderRadius: 3, background: `linear-gradient(135deg,${ac},${ad})`,
                            }} />
                          </div>
                          <div style={{ fontFamily: s.font, fontSize: 10, fontWeight: 600, color: sel?ac:"#64748B" }}>{p.label}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>


            {/* 5. AI PERSONA & DAVRANIŞ */}
            <div style={{ background: s.card, borderRadius: 14, overflow: "hidden", border: `1px solid rgba(${acRgb},0.08)`, boxShadow: `0 0 0 1px rgba(${acRgb},0.03), 0 4px 16px rgba(${acRgb},0.024)` }}>
              <SectionHeader icon="🤖" title={_t("wA.sec.ai")} count={8} badge="AI" isOpen={openSection===12} onToggle={()=>tog(12)} isNew />
              {openSection===12 && (
                <div style={{ padding: 18, animation: "fadeUp 0.3s ease both" }}>
                  {/* AI Identity Card */}
                  <div style={{ padding: "14px 16px", borderRadius: 12, background: `linear-gradient(135deg, rgba(${acRgb},0.03), rgba(${acRgb},0.012))`, border: `1px solid rgba(${acRgb},0.08)`, marginBottom: 14, display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg,${ac},${ad})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, boxShadow: `0 4px 12px rgba(${acRgb},0.19)`, flexShrink: 0 }}>{botAvatar}</div>
                    <div style={{ flex: 1 }} onClick={() => { if (isFree) showUpgrade("AI Adı"); }}>
                      <input disabled={isFree} value={aiName} onChange={e=>{setAiName(e.target.value);markChanged();}} style={{ width: "100%", border: "none", background: "transparent", fontFamily: s.fontH, fontSize: 15, fontWeight: 800, color: "#1A1D23", outline: "none", padding: 0, cursor: isFree ? "not-allowed" : "text", opacity: isFree ? 0.75 : 1 }} placeholder="AI Asistan Adı"/>
                      <div style={{ fontFamily: s.font, fontSize: 10, color: "#64748B", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                        <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#10B981" }} />
                        Yapay Zeka Destekli Asistan
                      </div>
                    </div>
                    {aiLabel && <div style={{ fontSize: 8, fontWeight: 700, padding: "3px 7px", borderRadius: 5, background: `linear-gradient(135deg,${ac},${ad})`, color: "#FFF", whiteSpace: "nowrap" }}>AI Agent</div>}
                  </div>

                  {/* Tone */}
                  <label style={{...s.label, marginBottom: 8}}>🎭 İletişim Tonu</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginBottom: 14 }}>
                    {AI_TONES.map(t => { const sel = aiTone===t.id; const locked = isFree && t.id !== "friendly"; return (
                      <div key={t.id} onClick={()=>{if(locked){showUpgrade("İletişim Tonu");return;}setAiTone(t.id);markChanged();}} style={{ padding: "10px 6px", borderRadius: 10, cursor: "pointer", textAlign: "center", border: "none", boxShadow: sel ? `0 0 0 2px ${ac}, 0 4px 10px rgba(${acRgb},0.12)` : "0 1px 3px rgba(0,0,0,0.05)", background: sel ? `rgba(${acRgb},0.04)` : "#FAFAF8", transition: "all 0.25s", opacity: locked ? 0.6 : 1, position: "relative" }}>
                        {locked && <span style={{ position: "absolute", top: 2, right: 2, fontSize: 7, fontWeight: 700, padding: "1px 4px", borderRadius: 4, background: "linear-gradient(135deg,#8B5CF6,#7C3AED)", color: "#FFF" }}>PRO</span>}
                        <div style={{ fontSize: 18, marginBottom: 3 }}>{t.emoji}</div>
                        <div style={{ fontFamily: s.fontH, fontSize: 11.5, fontWeight: 700, color: sel ? ac : "#1A1D23" }}>{t.label}</div>
                        <div style={{ fontFamily: s.font, fontSize: 9.5, color: "#94A3B8", marginTop: 2 }}>{t.desc}</div>
                      </div>
                    );})}
                  </div>

                  {/* Response Length */}
                  <label style={{...s.label, marginBottom: 8}}>📏 Yanıt Uzunluğu</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginBottom: 14 }}>
                    {AI_LENGTHS.map(l => { const sel = aiLength===l.id; const locked = isFree && l.id !== "standard"; return (
                      <div key={l.id} onClick={()=>{if(locked){showUpgrade("Yanıt Uzunluğu");return;}setAiLength(l.id);markChanged();}} style={{ padding: "10px 8px", borderRadius: 10, cursor: "pointer", textAlign: "center", border: "none", boxShadow: sel ? `0 0 0 2px ${ac}, 0 3px 8px rgba(${acRgb},0.09)` : "0 1px 3px rgba(0,0,0,0.05)", background: sel ? `rgba(${acRgb},0.04)` : "#FAFAF8", transition: "all 0.25s", opacity: locked ? 0.6 : 1, position: "relative" }}>
                        {locked && <span style={{ position: "absolute", top: 2, right: 2, fontSize: 7, fontWeight: 700, padding: "1px 4px", borderRadius: 4, background: "linear-gradient(135deg,#8B5CF6,#7C3AED)", color: "#FFF" }}>PRO</span>}
                        <div style={{ fontFamily: s.fontH, fontSize: 12, fontWeight: 700, color: sel ? ac : "#1A1D23" }}>{l.label}</div>
                        <div style={{ fontFamily: s.font, fontSize: 10, color: "#94A3B8", marginTop: 2 }}>{l.desc}</div>
                      </div>
                    );})}
                  </div>

                  {/* AI Model */}
                  <label style={{...s.label, marginBottom: 8, display: "flex", alignItems: "center", gap: 5}}>
                    ⚡ AI Model
                    {!isPro && <span style={{ fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "linear-gradient(135deg,#8B5CF6,#7C3AED)", color: "#FFF" }}>PRO</span>}
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 5, marginBottom: 14 }}>
                    {AI_MODELS.map(m => { const sel = aiModel===m.id; const locked = !isPro && m.id !== "auto"; return (
                      <div key={m.id} onClick={()=>{if(locked){showUpgrade("AI Model");return;}setAiModel(m.id);markChanged();}} style={{ padding: "8px 5px", borderRadius: 8, cursor: "pointer", textAlign: "center", border: "none", boxShadow: sel ? `0 0 0 2px ${ac}` : "0 1px 2px rgba(0,0,0,0.04)", background: sel ? `rgba(${acRgb},0.03)` : "#FAFAF8", transition: "all 0.25s", opacity: locked ? 0.55 : 1, position: "relative" }}>
                        {locked && <span style={{ position: "absolute", top: 2, right: 2, fontSize: 7, fontWeight: 700, padding: "1px 4px", borderRadius: 4, background: "linear-gradient(135deg,#8B5CF6,#7C3AED)", color: "#FFF" }}>PRO</span>}
                        <div style={{ fontFamily: s.fontH, fontSize: 11, fontWeight: 700, color: sel ? ac : "#475569" }}>{m.label}</div>
                        <div style={{ fontFamily: s.font, fontSize: 9, color: "#94A3B8", marginTop: 2 }}>{m.desc}</div>
                      </div>
                    );})}
                  </div>

                  {/* AI Welcome */}
                  <label style={{...s.label, marginBottom: 6}}>💬 AI Karşılama Mesajı</label>
                  <div onClick={() => { if (isFree) showUpgrade("AI Karşılama Mesajı"); }}>
                    <textarea disabled={isFree} value={aiWelcome} onChange={e=>{setAiWelcome(e.target.value);markChanged();}} style={{ width: "100%", minHeight: 60, padding: "8px 12px", borderRadius: 9, border: "1.5px solid #E8E0D4", fontFamily: s.font, fontSize: 12, color: "#1A1D23", background: "#FFFCF8", outline: "none", resize: "vertical", marginBottom: 12, cursor: isFree ? "not-allowed" : "text", opacity: isFree ? 0.75 : 1 }} onFocus={e=>e.target.style.borderColor=ac} onBlur={e=>e.target.style.borderColor="#E8E0D4"} />
                  </div>

                  {/* AI Toggles */}
                  <Toggle checked={aiEmoji} onChange={v=>{setAiEmoji(v);markChanged();}} label="Emoji Kullanımı" desc="AI yanıtlarında emoji kullansın" />
                  <Toggle checked={aiLabel} onChange={v=>{setAiLabel(v);markChanged();}} label="AI Agent Etiketi" desc="Mesajlarda 'AI Agent' rozeti göster" />
                  <Toggle checked={aiSuggestions} onChange={v=>{if(!isPro){showUpgrade("Akıllı Öneriler");return;}setAiSuggestions(v);markChanged();}} label="Akıllı Öneriler" desc="Ziyaretçi sorularına göre otomatik öneri" pro={!isPro} />
                </div>
              )}
            </div>

            {/* 6. ATTENTION GRABBER 🔥 */}
            <div style={{ background: s.card, borderRadius: 14, overflow: "hidden", border: s.border }}>
              <SectionHeader icon="👋" title={_t("wA.sec.attGrabber")} count={3} isOpen={openSection===4} onToggle={()=>tog(4)} isNew />
              {openSection===4 && (
                <div style={{ padding: 18, animation: "fadeUp 0.3s ease both" }}>
                  <p style={{ fontSize: 11, color: "#64748B", marginTop: 0, marginBottom: 12, lineHeight: 1.5 }}>
                    Ziyaretçinin dikkatini çekmek için widget'ın yanında bir animasyon veya mesaj gösterin.
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6, marginBottom: 14 }}>
                    {ATTENTION_GRABBERS.map(ag => {
                      const sel = attGrabber.id===ag.id;
                      return (
                        <div key={ag.id} onClick={()=>{setAttGrabber(ag);markChanged();}} style={{
                          padding: "10px 4px", borderRadius: 10, cursor: "pointer", textAlign: "center",
                          border: sel?`2px solid ${ac}`:"2px solid #F1F5F9", background: sel?`rgba(${acRgb},0.04)`:"#FAFAF8", transition: "all 0.25s",
                        }}>
                          <div style={{ fontSize: 20, marginBottom: 4 }}>{ag.emoji}</div>
                          <div style={{ fontFamily: s.font, fontSize: 9, fontWeight: 600, color: sel?ac:"#64748B" }}>{ag.label}</div>
                        </div>
                      );
                    })}
                  </div>
                  {attGrabber.id !== "none" && (
                    <>
                      {attGrabber.id === "message" && (
                        <div style={{ marginBottom: 10 }}>
                          <label style={s.label}>Mesaj Metni</label>
                          <input value={attGrabberText} onChange={e=>{setAttGrabberText(e.target.value);markChanged();}} style={{...s.input, fontSize: 12}}
                            onFocus={e=>e.target.style.borderColor=ac} onBlur={e=>e.target.style.borderColor="#E8E0D4"} />
                        </div>
                      )}
                      <label style={s.label}>Gecikme: {attGrabberDelay}sn</label>
                      <input type="range" min={0} max={30} value={attGrabberDelay} onChange={e=>{setAttGrabberDelay(Number(e.target.value));markChanged();}}
                        style={{ width: "100%", accentColor: ac }} />
                    </>
                  )}
                </div>
              )}
            </div>

            {/* 7. AVATAR & LOGO */}
            <div style={{ background: s.card, borderRadius: 14, overflow: "hidden", border: s.border }}>
              <SectionHeader icon="🖼️" title={_t("wA.sec.avatar")} count={3} isOpen={openSection===5} onToggle={()=>tog(5)} />
              {openSection===5 && (
                <div style={{ padding: 18, animation: "fadeUp 0.3s ease both" }}>
                  {/* Bot Avatar */}
                  <label style={{...s.label,display:"flex",alignItems:"center",gap:4,marginBottom:8}}>🤖 Bot Avatarı</label>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
                    {["🤖","💬","🎧","🛟","⚡","🌟"].map(e=>(
                      <div key={e} onClick={()=>{setBotAvatar(e);markChanged();}} style={{
                        width:44,height:44,borderRadius:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,
                        border:botAvatar===e?`2.5px solid ${ac}`:"2.5px solid #F1F5F9", background:botAvatar===e?`rgba(${acRgb},0.06)`:"#FAFAF8",
                        boxShadow:botAvatar===e?`0 3px 10px rgba(${acRgb},0.12)`:"none", transition:"all 0.25s",
                      }}>{e}</div>
                    ))}
                  </div>

                  {/* Agent Avatar - Emoji + Photo Upload */}
                  <label style={{...s.label,display:"flex",alignItems:"center",gap:4,marginBottom:8}}>👩‍💼 Temsilci Avatarı & Fotoğrafı</label>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
                    {["👩‍💼","👨‍💻","🧑‍💼","👩‍🔧","🧑‍🚀","👨‍🎓"].map(e=>(
                      <div key={e} onClick={()=>{setAgentAvatar(e);setAgentImagePreview(null);setAgentImage(null);markChanged();}} style={{
                        width:44,height:44,borderRadius:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,
                        border:agentAvatar===e && !agentImagePreview?`2.5px solid ${ac}`:"2.5px solid #F1F5F9",
                        background:agentAvatar===e && !agentImagePreview?`rgba(${acRgb},0.06)`:"#FAFAF8",
                        boxShadow:agentAvatar===e && !agentImagePreview?`0 3px 10px rgba(${acRgb},0.12)`:"none", transition:"all 0.25s",
                      }}>{e}</div>
                    ))}
                  </div>
                  <input ref={agentImgRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAgentImageUpload} style={{display:"none"}} />
                  {agentImagePreview ? (
                    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderRadius:10, border:`1.5px solid rgba(${acRgb},0.19)`, background:`rgba(${acRgb},0.02)`, marginBottom:14 }}>
                      <img src={agentImagePreview} alt="Agent" style={{ width:44, height:44, borderRadius:12, objectFit:"cover", border:`2px solid ${ac}` }} />
                      <div style={{ flex:1 }}>
                        <div style={{ fontFamily:s.fontH, fontSize:11, fontWeight:700, color:"#1A1D23" }}>{agentImage?.name}</div>
                        <div style={{ fontFamily:s.fontMono, fontSize:9, color:"#94A3B8" }}>{agentImage ? (agentImage.size/1024).toFixed(1)+" KB" : ""}</div>
                      </div>
                      <button onClick={removeAgentImage} style={{ padding:"4px 8px", borderRadius:6, border:"1px solid #FEE2E2", background:"#FFF5F5", fontFamily:s.font, fontSize:10, fontWeight:600, color:"#EF4444", cursor:"pointer" }}>✕</button>
                    </div>
                  ) : (
                    <div onClick={()=>agentImgRef.current?.click()} style={{ padding:"12px", borderRadius:10, border:"2px dashed #E8E0D4", textAlign:"center", background:"#FFFCF8", cursor:"pointer", marginBottom:14 }}>
                      <div style={{ fontSize:18, marginBottom:2 }}>📷</div>
                      <div style={{ fontFamily:s.font, fontSize:10.5, fontWeight:600, color:"#64748B" }}>Temsilci fotoğrafı yükle</div>
                      <div style={{ fontFamily:s.font, fontSize:8.5, color:"#94A3B8", marginTop:1 }}>PNG, JPG, WebP — Maks 2MB · Tüm planlarda</div>
                    </div>
                  )}
                  <div style={{ marginTop: 16 }}>
                    <label style={s.label}>🏢 Marka Logosu {!isPro && <span style={{fontSize:9,color:"#7C3AED",fontWeight:700}}>PRO</span>}</label>
                    <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={handleLogoUpload} style={{display:"none"}} />
                    {logoPreview ? (
                      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderRadius:10, border:`1.5px solid rgba(${acRgb},0.19)`, background:`rgba(${acRgb},0.02)` }}>
                        <img src={logoPreview} alt="Logo" style={{ width:48, height:48, borderRadius:10, objectFit:"contain", background:"#FFF", border:"1px solid #E8E0D4", padding:4 }} />
                        <div style={{ flex:1 }}>
                          <div style={{ fontFamily:s.font, fontSize:12, fontWeight:600, color:"#1A1D23" }}>{logoFile?.name}</div>
                          <div style={{ fontFamily:s.fontMono, fontSize:10, color:"#94A3B8" }}>{logoFile ? (logoFile.size/1024).toFixed(1)+" KB" : ""}</div>
                        </div>
                        <button onClick={removeLogo} style={{ padding:"5px 10px", borderRadius:7, border:"1px solid #FEE2E2", background:"#FFF5F5", fontFamily:s.font, fontSize:10.5, fontWeight:600, color:"#EF4444", cursor:"pointer" }}>🗑 Kaldır</button>
                      </div>
                    ) : (
                      <div onClick={()=>{ if(isFree){ showUpgrade("Marka Logosu"); return; } logoRef.current?.click(); }} style={{ padding:"16px", borderRadius:10, border:"2px dashed #E8E0D4", textAlign:"center", background:"#FFFCF8", cursor:"pointer", opacity:isFree?0.7:1 }}>
                        <div style={{ fontSize:24, marginBottom:4 }}>📁</div>
                        <div style={{ fontFamily:s.font, fontSize:11, fontWeight:600, color:"#64748B" }}>Tıklayarak logo yükleyin</div>
                        <div style={{ fontFamily:s.font, fontSize:9, color:"#94A3B8", marginTop:2 }}>PNG, JPG, SVG, WebP — Maks 2MB</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 8. BOYUT & ARKA PLAN */}
            <div style={{ background: s.card, borderRadius: 14, overflow: "hidden", border: s.border }}>
              <SectionHeader icon="📐" title={_t("wA.sec.sizeBackground")} count={SIZES.length + BACKGROUNDS.length} isOpen={openSection===6} onToggle={()=>tog(6)} />
              {openSection===6 && (
                <div style={{ padding: 18, animation: "fadeUp 0.3s ease both" }}>
                  <label style={{...s.label,marginBottom:8}}>Widget Boyutu</label>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:16}}>
                    {SIZES.map(sz=>{const sel=widgetSize.id===sz.id;return(
                      <div key={sz.id} onClick={()=>{setWidgetSize(sz);markChanged();}} style={{padding:"12px 8px",borderRadius:10,cursor:"pointer",textAlign:"center",border:"none",boxShadow:sel?`0 0 0 2px ${ac}, 0 4px 12px rgba(${acRgb},0.12)`:"0 1px 4px rgba(0,0,0,0.06)",background:sel?`rgba(${acRgb},0.04)`:"#FAFAF8",transition:"all 0.3s ease",transform:sel?"translateY(-1px)":"translateY(0)"}}>
                        <div style={{width:22,height:Math.round(sz.h/13),borderRadius:4,margin:"0 auto 6px",border:`2px solid ${sel?ac:"#CBD5E1"}`,transition:"all 0.3s"}} />
                        <div style={{fontFamily:s.fontH,fontSize:11,fontWeight:700,color:sel?ac:"#1A1D23"}}>{sz.label}</div>
                        <div style={{fontFamily:s.fontMono,fontSize:9,color:"#94A3B8",marginTop:2}}>{sz.w}×{sz.h}</div>
                      </div>
                    );})}
                  </div>
                  <label style={{...s.label,marginBottom:8}}>Sohbet Arka Plan Deseni</label>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
                    {BACKGROUNDS.map(bg=>{const sel=bgPattern.id===bg.id;const locked=bg.pro&&isFree;return(
                      <div key={bg.id} onClick={()=>{if(locked){showUpgrade(bg.name+" Desen");return;}setBgPattern(bg);markChanged();}} style={{
                        padding:"10px 4px",borderRadius:10,cursor:"pointer",textAlign:"center",position:"relative",
                        border:"none",boxShadow:sel?`0 0 0 2px ${ac}, 0 3px 10px rgba(${acRgb},0.12)`:"0 1px 3px rgba(0,0,0,0.05)",background:sel?`rgba(${acRgb},0.04)`:"#FAFAF8",transition:"all 0.3s ease",opacity:locked?0.6:1,
                      }}>
                        {bg.pro && !isPro && <div style={{position:"absolute",top:2,right:2,fontSize:7,fontWeight:700,padding:"1px 4px",borderRadius:3,background:"linear-gradient(135deg,#8B5CF6,#7C3AED)",color:"#FFF",zIndex:1}}>PRO</div>}
                        <div style={{width:32,height:28,borderRadius:5,margin:"0 auto 4px",background:"#FFF",border:"1px solid #E2E8F0",overflow:"hidden",position:"relative"}}>
                          {bg.pattern && <div style={{position:"absolute",inset:0,backgroundImage:bg.pattern,backgroundSize:bg.size||(bg.id==="grid"?"16px 16px":"8px 8px"),color:`rgba(${acRgb},0.25)`}} />}
                          {bg.isSvg && <svg viewBox="0 0 32 28" style={{position:"absolute",inset:0}}><path d="M0,20 Q8,14 16,18 T32,16 L32,28 L0,28 Z" fill={`rgba(${acRgb},0.08)`}/></svg>}
                        </div>
                        <div style={{fontFamily:s.font,fontSize:9,fontWeight:600,color:sel?ac:"#64748B"}}>{bg.name}</div>
                      </div>
                    );})}
                  </div>
                </div>
              )}
            </div>

            {/* 9. ÖN FORM */}
            <div style={{ background: s.card, borderRadius: 14, overflow: "hidden", border: s.border }}>
              <SectionHeader icon="📋" title={_t("wA.sec.prechat")} count={4} badge={!isPro ? "PRO" : undefined} isOpen={openSection===7} onToggle={()=>tog(7)} />
              {openSection===7 && (
                <div style={{ padding: 18, animation: "fadeUp 0.3s ease both" }}>
                  <Toggle checked={preChatEnabled} onChange={v=>{if(!isPro){showUpgrade("Ön Form (Pre-Chat)");return;}setPreChatEnabled(v);markChanged();}} label="Ön Form Aktif" desc="Sohbet başlamadan ad ve email iste" pro={!isPro} />
                  <div style={{ marginTop: 12, opacity: preChatEnabled?1:0.4, pointerEvents: preChatEnabled?"auto":"none", transition: "opacity 0.3s" }}>
                    {[{n:"Ad Soyad",e:"👤",req:true},{n:"Email",e:"✉️",req:true},{n:"Telefon",e:"📞",req:false},{n:"Departman",e:"🏢",req:false}].map((f,i)=>(
                      <div key={f.n} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 0",borderBottom:i<3?"1px solid #F8F4EF":"none"}}>
                        <div style={{display:"flex",alignItems:"center",gap:7}}>
                          <div style={{width:26,height:26,borderRadius:7,background:f.req?`rgba(${acRgb},0.06)`:"#F8F4EF",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}>{f.e}</div>
                          <span style={{fontFamily:s.font,fontSize:12,fontWeight:600,color:"#1A1D23"}}>{f.n}</span>
                        </div>
                        <span style={{fontSize:9,fontWeight:600,color:f.req?"#10B981":"#94A3B8",background:f.req?"#D1FAE5":"#F1F5F9",padding:"2px 7px",borderRadius:5}}>{f.req?"Zorunlu":"Opsiyonel"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 10. ÇALIŞMA SAATLERİ 🔥 */}
            <div style={{ background: s.card, borderRadius: 14, overflow: "hidden", border: s.border }}>
              <SectionHeader icon="🕐" title={_t("wA.sec.hours")} count={7} isOpen={openSection===8} onToggle={()=>tog(8)} isNew />
              {openSection===8 && (
                <div style={{ padding: 18, animation: "fadeUp 0.3s ease both" }}>
                  <Toggle checked={hoursEnabled} onChange={v=>{setHoursEnabled(v);markChanged();}} label="Zamanlayıcı Aktif" desc="Widget otomatik olarak çevrimiçi/çevrimdışı olsun" />
                  <div style={{ marginTop: 8, opacity: hoursEnabled?1:0.4, pointerEvents: hoursEnabled?"auto":"none" }}>
                    {/* Timezone */}
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                      <span style={{ fontFamily:s.fontH, fontSize:12, fontWeight:700, color:"#475569" }}>🌍 Zaman Dilimi</span>
                      <select value={timezone} onChange={e=>{setTimezone(e.target.value);markChanged();}} style={{ fontFamily:s.fontH, fontSize:11, fontWeight:600, padding:"5px 10px", borderRadius:8, border:"1.5px solid #E8E0D4", background:"#FFFCF8", outline:"none", color:"#1A1D23", cursor:"pointer" }}>
                        {["Europe/Istanbul","Europe/London","Europe/Berlin","America/New_York","America/Los_Angeles","Asia/Tokyo"].map(tz=><option key={tz} value={tz}>{tz.replace("_"," ")}</option>)}
                      </select>
                    </div>
                    {hours.map((h,i)=>(
                      <div key={h.day} style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "7px 0",
                        borderBottom: i<6?"1px solid #F8F4EF":"none",
                      }}>
                        <div onClick={()=>toggleDay(i)} style={{
                          width: 40, textAlign: "center", fontFamily: s.fontH, fontSize: 12, fontWeight: 700,
                          color: h.on?ac:"#94A3B8", cursor: "pointer",
                          padding: "4px 0", borderRadius: 6,
                          background: h.on?`rgba(${acRgb},0.06)`:"transparent", transition: "all 0.25s",
                        }}>{h.day}</div>
                        {h.on ? (
                          <div style={{display:"flex",alignItems:"center",gap:6,flex:1}}>
                            <input type="time" value={h.start} onChange={e=>updateHour(i,"start",e.target.value)}
                              style={{fontFamily:s.fontH,fontSize:11.5,fontWeight:600,padding:"5px 10px",borderRadius:8,border:"1.5px solid #E8E0D4",background:"#FFFCF8",outline:"none",color:"#1A1D23",cursor:"pointer"}} />
                            <span style={{color:"#94A3B8",fontSize:12,fontWeight:700}}>—</span>
                            <input type="time" value={h.end} onChange={e=>updateHour(i,"end",e.target.value)}
                              style={{fontFamily:s.fontH,fontSize:11.5,fontWeight:600,padding:"5px 10px",borderRadius:8,border:"1.5px solid #E8E0D4",background:"#FFFCF8",outline:"none",color:"#1A1D23",cursor:"pointer"}} />
                          </div>
                        ) : (
                          <span style={{fontFamily:s.fontH,fontSize:11.5,fontWeight:600,color:"#CBD5E1",fontStyle:"italic"}}>Kapalı</span>
                        )}
                      </div>
                    ))}
                    <button onClick={applyToAll} style={{ marginTop:8, padding:"9px 14px", borderRadius:8, border:`1px solid rgba(${acRgb},0.19)`, background:`rgba(${acRgb},0.03)`, fontFamily:s.fontH, fontSize:11, fontWeight:700, color:ac, cursor:"pointer" }}>📋 İlk günün saatlerini tümüne uygula</button>
                  </div>
                </div>
              )}
            </div>

            {/* 11. GENEL AYARLAR */}
            <div style={{ background: s.card, borderRadius: 14, overflow: "hidden", border: s.border }}>
              <SectionHeader icon="⚙️" title={_t("wA.sec.general")} count={14} isOpen={openSection===9} onToggle={()=>tog(9)} />
              {openSection===9 && (
                <div style={{ padding: "6px 18px 18px", animation: "fadeUp 0.3s ease both" }}>
                  <Toggle checked={showOnMobile} onChange={v=>{setShowOnMobile(v);markChanged();}} label="Mobilde Göster" desc="Widget'ı mobil cihazlarda göster" />
                  <Toggle checked={showOffline} onChange={v=>{setShowOffline(v);markChanged();}} label="Çevrimdışı Göster" desc="Tüm ajanlar çevrimdışıyken widget görünsün" />
                  <Toggle checked={soundEnabled} onChange={v=>{setSoundEnabled(v);markChanged();}} label="Bildirim Sesi" desc="Yeni mesajlarda ses çal" />
                  <Toggle checked={autoOpen} onChange={v=>{setAutoOpen(v);markChanged();}} label="Otomatik Aç" desc="Sayfa yüklendiğinde widget açılsın" />
                  <Toggle checked={showUnread} onChange={v=>{setShowUnread(v);markChanged();}} label="Okunmamış Rozet" desc="Başlatıcıda okunmamış sayısı" />
                  <Toggle checked={typingIndicator} onChange={v=>{setTypingIndicator(v);markChanged();}} label="Yazıyor Göstergesi" desc="Karşı taraf yazarken göster" />
                  <Toggle checked={readReceipts} onChange={v=>{setReadReceipts(v);markChanged();}} label="Okundu Bilgisi" desc="Mesaj okunduğunda ✓✓ göster" />
                  <Toggle checked={responseTime} onChange={v=>{setResponseTime(v);markChanged();}} label="Yanıt Süresi Rozeti" desc="'Genellikle X dk içinde yanıt' göster" />
                  <Toggle checked={fileUpload} onChange={v=>{setFileUpload(v);markChanged();}} label="Dosya Yükleme" desc="Ziyaretçilerin dosya göndermesine izin ver" />
                  <Toggle checked={emojiPicker} onChange={v=>{setEmojiPicker(v);markChanged();}} label="Emoji Seçici" desc="Sohbette emoji menüsü" />
                  <Toggle checked={visitorNotes} onChange={v=>{setVisitorNotes(v);markChanged();}} label="Ziyaretçi Notları" desc="Temsilcilerin ziyaretçi hakkında not eklemesi" />
                  <Toggle checked={transcriptEmail} onChange={v=>{if(!isPro){showUpgrade("Sohbet Dökümü Email");return;}setTranscriptEmail(v);markChanged();}} label="Sohbet Dökümü Email" desc="Sohbet bitince ziyaretçiye döküm gönder" pro={!isPro} />
                  <Toggle checked={showBranding} onChange={v=>{if(!isPro && !v){showUpgrade("Markayı Kaldır");return;}setShowBranding(v);markChanged();}} label="Helvion Markası" desc="Kaldırmak için PRO plan gerekli" pro={!isPro} />
                </div>
              )}
            </div>

            {/* 12. PRO ÖZELLİKLER */}
            <div style={{ background: s.card, borderRadius: 14, overflow: "hidden", border: "1px solid rgba(139,92,246,0.1)", boxShadow: "0 0 0 1px rgba(139,92,246,0.06)" }}>
              <SectionHeader icon="👑" title={_t("wA.sec.pro")} count={6} badge={!isPro ? "PRO" : undefined} isOpen={openSection===10} onToggle={()=>tog(10)} />
              {openSection===10 && (
                <div style={{ padding: "6px 18px 18px", animation: "fadeUp 0.3s ease both" }}>
                  <Toggle checked={csat} onChange={v=>{if(!isPro){showUpgrade("CSAT Anketi");return;}setCsat(v);markChanged();}} label="Memnuniyet Anketi (CSAT)" desc="Sohbet sonunda ⭐ puan iste" pro={!isPro} />
                  <Toggle checked={whiteLabel} onChange={v=>{if(!isPro){showUpgrade("White Label");return;}setWhiteLabel(v);markChanged();}} label="White Label" desc="Helvion markasını tamamen kaldır" pro={!isPro} />
                  <Toggle checked={autoReply} onChange={v=>{if(!isPro){showUpgrade("Otomatik Yanıt");return;}setAutoReply(v);markChanged();}} label="Otomatik Yanıt" desc="Çevrimdışıyken otomatik mesaj gönder" pro={!isPro} />
                  {autoReply && (
                    <div style={{ paddingLeft: 8, paddingBottom: 8 }}>
                      <textarea value={autoReplyMsg} onChange={e=>{setAutoReplyMsg(e.target.value);markChanged();}}
                        style={{ width:"100%", minHeight:50, padding:"8px 10px", borderRadius:8, border:"1.5px solid #E8E0D4", fontFamily:s.font, fontSize:12, color:"#1A1D23", background:"#FFFCF8", outline:"none", resize:"vertical" }}
                        onFocus={e=>e.target.style.borderColor=ac} onBlur={e=>e.target.style.borderColor="#E8E0D4"} />
                    </div>
                  )}
                  <Toggle checked={consentEnabled} onChange={v=>{if(!isPro){showUpgrade("GDPR Onay Formu");return;}setConsentEnabled(v);markChanged();}} label="GDPR Onay Formu" desc="Sohbet öncesi gizlilik onayı" pro={!isPro} />
                  {consentEnabled && (
                    <div style={{ paddingLeft: 8, paddingBottom: 8 }}>
                      <textarea value={consentText} onChange={e=>{setConsentText(e.target.value);markChanged();}}
                        style={{ width:"100%", minHeight:50, padding:"8px 10px", borderRadius:8, border:"1.5px solid #E8E0D4", fontFamily:s.font, fontSize:12, color:"#1A1D23", background:"#FFFCF8", outline:"none", resize:"vertical" }}
                        onFocus={e=>e.target.style.borderColor=ac} onBlur={e=>e.target.style.borderColor="#E8E0D4"} />
                    </div>
                  )}
                  {/* Custom CSS */}
                  <div style={{ marginTop: 8, padding: "10px 0", borderTop: "1px solid #F8F4EF" }}>
                    <label style={{ fontFamily: s.font, fontSize: 12, fontWeight: 600, color: "#475569", display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
                      🎨 Özel CSS {!isPro && <span style={{ fontSize:9, fontWeight:700, padding:"2px 6px", borderRadius:4, background:"linear-gradient(135deg,#8B5CF6,#7C3AED)", color:"#FFF" }}>PRO</span>}
                    </label>
                    <textarea value={customCss} onChange={e=>{if(!isPro){showUpgrade("Özel CSS");return;}setCustomCss(e.target.value);markChanged();}}
                      placeholder={`.helvion-widget { border-radius: 20px; }\n.helvion-header { background: #000; }`}
                      style={{ width:"100%", minHeight:70, padding:"8px 10px", borderRadius:8, border:"1.5px solid #E8E0D4", fontFamily:s.fontMono, fontSize:11, color:"#1A1D23", background:"#FFFCF8", outline:"none", resize:"vertical" }}
                      onFocus={e=>e.target.style.borderColor=ac} onBlur={e=>e.target.style.borderColor="#E8E0D4"} />
                  </div>
                </div>
              )}
            </div>

            {/* 13. SAYFA KURALLARI & LİNK */}
            <div style={{ background: s.card, borderRadius: 14, overflow: "hidden", border: s.border }}>
              <SectionHeader icon="🔗" title={_t("wA.sec.pageRules")} count={pageRules.length+1} badge={!isPro ? "PRO" : undefined} isOpen={openSection===11} onToggle={()=>tog(11)} isNew />
              {openSection===11 && (
                <div style={{ padding: 18, animation: "fadeUp 0.3s ease both" }}>
                  <label style={{ fontFamily: s.font, fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>📄 Sayfa Bazlı Görünürlük {!isPro && <span style={{ fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "linear-gradient(135deg,#8B5CF6,#7C3AED)", color: "#FFF" }}>PRO</span>}</label>
                  <p style={{ fontSize: 11, color: "#64748B", margin: "0 0 8px", lineHeight: 1.4 }}>Belirli sayfalarda widget'ı göster veya gizle</p>
                  <div style={{ opacity: !isPro ? 0.5 : 1, pointerEvents: !isPro ? "none" : "auto", transition: "opacity 0.3s" }}>
                  {pageRules.map(r=>(
                    <div key={r.id} style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 0", borderBottom:"1px solid #F8F4EF" }}>
                      <span style={{ fontFamily:s.fontMono, fontSize:11, color:"#1A1D23", flex:1 }}>{r.url}</span>
                      <span style={{ fontSize:9, fontWeight:600, padding:"2px 6px", borderRadius:4, background:r.action==="show"?"#D1FAE5":"#FEE2E2", color:r.action==="show"?"#059669":"#DC2626" }}>{r.action==="show"?"Göster":"Gizle"}</span>
                      <span onClick={()=>removePageRule(r.id)} style={{ cursor:"pointer", color:"#CBD5E1", fontSize:13 }}>×</span>
                    </div>
                  ))}
                  <div style={{ display:"flex", gap:5, marginTop:8 }}>
                    <input value={newPageUrl} onChange={e=>setNewPageUrl(e.target.value)} placeholder="/sayfa-yolu" onKeyDown={e=>e.key==="Enter"&&addPageRule()}
                      style={{ flex:1, padding:"6px 9px", borderRadius:7, border:"1.5px solid #E8E0D4", fontFamily:s.fontMono, fontSize:11, outline:"none", background:"#FFFCF8" }} />
                    <select value={newPageAction} onChange={e=>setNewPageAction(e.target.value)} style={{ padding:"6px 8px", borderRadius:7, border:"1.5px solid #E8E0D4", fontFamily:s.font, fontSize:11, background:"#FFFCF8", outline:"none" }}>
                      <option value="show">Göster</option><option value="hide">Gizle</option>
                    </select>
                    <button onClick={()=>{if(!isPro){showUpgrade("Sayfa Kuralları");return;}addPageRule();}} style={{ padding:"6px 10px", borderRadius:7, border:"none", background:`linear-gradient(135deg,${ac},${ad})`, color:"#FFF", fontFamily:s.fontH, fontSize:10, fontWeight:700, cursor:"pointer" }}>+</button>
                  </div>
                  </div>
                  {/* Direct Chat Link */}
                  <div style={{ marginTop:16, padding:"12px", borderRadius:10, background:"#F8F4EF", border:"1px solid #F3E8D8" }}>
                    <label style={{ fontFamily:s.font, fontSize:12, fontWeight:600, color:"#475569", marginBottom:6, display:"block" }}>🔗 Direkt Sohbet Linki</label>
                    <p style={{ fontSize:10, color:"#64748B", margin:"0 0 8px", lineHeight:1.4 }}>Bu linki paylaşarak widget'ı doğrudan açın</p>
                    <div style={{ display:"flex", gap:5 }}>
                      <input value={directChatLink} readOnly style={{ flex:1, padding:"6px 9px", borderRadius:7, border:"1.5px solid #E8E0D4", fontFamily:s.fontMono, fontSize:10, background:"#FFF", outline:"none", color:"#1A1D23" }} />
                      <button onClick={copyLink} style={{ padding:"8px 12px", borderRadius:7, border:"none", background:linkCopied?"#10B981":`linear-gradient(135deg,${ac},${ad})`, color:"#FFF", fontFamily:s.font, fontSize:10, fontWeight:600, cursor:"pointer", transition:"all 0.3s" }}>{linkCopied?"✓":"📋"}</button>
                    </div>
                  </div>
                </div>
              )}
            </div>


          </div>
        </div>
        <div style={{
          background: "#F8F4EF", borderLeft: "1px solid #F3E8D8", padding: "16px 18px",
          position: "sticky", top: 80, height: "calc(100vh - 100px)", overflowY: "auto", display: "flex", flexDirection: "column",
        }}>
          {/* Preview Controls */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#10B981", animation: "dotPulse 2s infinite" }} />
              <span style={{ fontFamily: s.fontH, fontSize: 12, fontWeight: 700, color: "#1A1D23" }}>Canlı Önizleme</span>
            </div>
            {/* Device Toggle */}
            <div style={{ display: "flex", background: "#FFF", borderRadius: 8, border: "1px solid #E8E0D4", overflow: "hidden" }}>
              {["desktop","mobile"].map(d=>(
                <div key={d} onClick={()=>setDevicePreview(d)} style={{
                  padding: "5px 12px", cursor: "pointer", fontSize: 13,
                  background: devicePreview===d?`linear-gradient(135deg,${ac},${ad})`:"transparent",
                  color: devicePreview===d?"#FFF":"#94A3B8",
                  transition: "all 0.3s",
                }}>{d==="desktop"?"🖥":"📱"}</div>
              ))}
            </div>
          </div>

          {/* Preview State Tabs — BÜYÜTÜLDÜ */}
          <div style={{ display: "flex", gap: 4, marginBottom: 14, background: "#FFF", borderRadius: 12, padding: 4, border: "1px solid #E8E0D4" }}>
            {PREVIEW_STATES.map(ps=>{const sel=previewState.id===ps.id;return(
              <div key={ps.id} onClick={()=>setPreviewState(ps)} style={{
                flex:1, padding: "10px 5px", borderRadius: 9, cursor: "pointer", textAlign: "center",
                background: sel?`linear-gradient(135deg,${ac},${ad})`:"transparent", transition: "all 0.3s",
              }}>
                <div style={{ fontSize: 17, marginBottom: 3 }}>{ps.icon}</div>
                <div style={{ fontFamily: s.fontH, fontSize: 11, fontWeight: 700, color: sel?"#FFF":"#94A3B8", letterSpacing: "0.01em" }}>{ps.label}</div>
              </div>
            );})}
          </div>

          {/* Preview Canvas */}
          <div style={{
            flex: 1, borderRadius: 14, overflow: "hidden", background: "#FFF", border: "1px solid #E8E0D4",
            position: "relative", boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
            width: devicePreview==="mobile" ? 280 : "100%",
            margin: devicePreview==="mobile" ? "auto" : "auto 0",
            transition: "width 0.4s ease",
          }}>
            {/* Fake site bg - Premium animated */}
            <div style={{ position: "absolute", inset: 0, background: `linear-gradient(160deg, #FAFAF8 0%, rgba(${acRgb},0.016) 30%, rgba(${acRgb},0.03) 60%, rgba(${acRgb},0.012) 100%)`, zIndex: 0, overflow: "hidden" }}>
              {/* Animated mesh blobs */}
              <div style={{ position: "absolute", width: 200, height: 200, borderRadius: "50%", background: `radial-gradient(circle, rgba(${acRgb},0.06), transparent 70%)`, top: -40, right: -60, animation: "meshFloat1 8s ease-in-out infinite" }} />
              <div style={{ position: "absolute", width: 150, height: 150, borderRadius: "50%", background: `radial-gradient(circle, rgba(${adRgb},0.03), transparent 70%)`, bottom: 20, left: -30, animation: "meshFloat2 10s ease-in-out infinite" }} />
              <div style={{ position: "absolute", width: 100, height: 100, borderRadius: "50%", background: `radial-gradient(circle, rgba(${acRgb},0.024), transparent 70%)`, top: "40%", right: "20%", animation: "meshFloat3 12s ease-in-out infinite" }} />
              <div style={{ height: 32, background: "rgba(255,255,255,0.85)", backdropFilter: "blur(8px)", borderBottom: `1px solid rgba(${acRgb},0.06)`, display: "flex", alignItems: "center", padding: "0 12px", gap: 6, position: "relative", zIndex: 1 }}>
                <div style={{width:7,height:7,borderRadius:"50%",background:"#FEE2E2"}} />
                <div style={{width:7,height:7,borderRadius:"50%",background:"#FEF3C7"}} />
                <div style={{width:7,height:7,borderRadius:"50%",background:"#D1FAE5"}} />
                <div style={{ flex: 1, height: 12, borderRadius: 6, background: `linear-gradient(90deg, rgba(${acRgb},0.03), rgba(${acRgb},0.016))`, marginLeft: 10 }} />
              </div>
              <div style={{ padding: "20px 16px", position: "relative", zIndex: 1 }}>
                {[65,85,55,75,45,70].map((w,i)=><div key={i} style={{height:7,width:`${w}%`,borderRadius:3,background:"#F1F5F9",marginBottom:8}} />)}
                <div style={{height:60,borderRadius:10,background:"#F8F4EF",marginTop:12}} />
              </div>
              {/* Wave overlay */}
              <svg viewBox="0 0 400 600" style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}} preserveAspectRatio="none">
                <defs><linearGradient id="wG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={ac} stopOpacity="0.035"/><stop offset="100%" stopColor={ac} stopOpacity="0"/></linearGradient></defs>
                <path d="M0,80 C100,120 200,40 300,90 C350,115 380,70 400,85 L400,0 L0,0 Z" fill="url(#wG)"/>
              </svg>
            </div>

            {/* Attention Grabber preview */}
            {previewState.id==="launcher" && attGrabber.id!=="none" && (
              <div style={{
                position:"absolute", zIndex:3,
                ...(devicePreview==="mobile" ? {left:"50%",transform:"translateX(-50%)"} : {[position.x]: launcher.hasText?20:72}),
                bottom: launcher.h?launcher.h+30:80,
                animation: attGrabber.id==="bounce"?"attBounce 1s ease infinite":attGrabber.id==="shake"?"shake 0.5s ease infinite":"fadeUp 0.4s ease both",
              }}>
                {attGrabber.id==="message" && (
                  <div style={{background:"#FFF",padding:"8px 12px",borderRadius:"12px 12px 12px 4px",boxShadow:"0 4px 16px rgba(0,0,0,0.1)",maxWidth:180}}>
                    <div style={{fontFamily:s.font,fontSize:11,color:"#1A1D23",lineHeight:1.4}}>{attGrabberText}</div>
                    <div style={{fontSize:9,color:"#CBD5E1",marginTop:3}}>Şimdi</div>
                  </div>
                )}
                {attGrabber.id==="wave" && <div style={{fontSize:28,animation:"shake 1s ease infinite"}}>👋</div>}
                {attGrabber.id==="pulse" && <div style={{width:14,height:14,borderRadius:"50%",background:ac,"--att-color":`rgba(${acRgb},0.25)`,animation:"attPulse 1.5s ease infinite"}} />}
              </div>
            )}

            {/* Widget */}
            {previewState.id==="launcher" ? (
              <div style={{
                position:"absolute", bottom:16, zIndex:2,
                ...(devicePreview==="mobile" ? {left:"50%",transform:"translateX(-50%)"} : {[position.x]:16}),
                perspective:"600px",
              }}>
              <div style={{
                animation:"widgetFloat 3s ease-in-out infinite",
                transformStyle:"preserve-3d",
              }}>
                <div style={{
                  width:launcher.w, height:launcher.h, borderRadius:launcher.radius,
                  background:ag,
                  display:"flex",alignItems:"center",justifyContent:"center",gap:6,
                  boxShadow:`0 8px 28px rgba(${acRgb},0.25)`, cursor:"pointer", transition:"all 0.5s",
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  {launcher.hasText && <span style={{fontFamily:s.fontH,fontSize:11,fontWeight:700,color:"#FFF"}}>{launcherLabel}</span>}
                </div>
                {showUnread && <div style={{position:"absolute",top:-3,right:-3,width:18,height:18,borderRadius:9,background:"#EF4444",color:"#FFF",fontFamily:s.fontH,fontSize:9,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid #FFF"}}>3</div>}
              </div>
              </div>
            ) : (
              <div style={{ position:"absolute", bottom:14, left: devicePreview==="mobile" ? "50%" : "auto", right: devicePreview==="mobile" ? "auto" : (position.x==="right" ? 14 : "auto"), [devicePreview==="mobile" ? "" : position.x]: devicePreview==="mobile" ? undefined : 14, transform: devicePreview==="mobile" ? "translateX(-50%)" : "none", width:Math.min(widgetSize.w*0.88,devicePreview==="mobile"?260:370), zIndex:2, perspective:"800px" }}>
              <div style={{ animation:"widgetFloat 4.5s ease-in-out infinite", transformStyle:"preserve-3d" }}>
                <div style={{ background:"#FFF", borderRadius:16, boxShadow:`0 10px 40px rgba(0,0,0,0.1), 0 4px 20px rgba(${acRgb},0.06)`, overflow:"hidden", transition:"box-shadow 0.5s" }}>
                  {/* Header */}
                  <div style={{ background:ag, padding:"18px 16px 14px", position:"relative", overflow:"hidden", transition:"background 0.5s" }}>
                    <div style={{position:"absolute",inset:0,background:"radial-gradient(circle at 85% 15%,rgba(255,255,255,0.12),transparent 60%)"}} />
                    <div style={{position:"relative",zIndex:1,display:"flex",alignItems:"center",gap:9}}>
                      <div style={{width:38,height:38,borderRadius:11,background:"rgba(255,255,255,0.2)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,border:"1px solid rgba(255,255,255,0.15)"}}>{botAvatar}</div>
                      <div style={{flex:1}}>
                        <div style={{fontFamily:s.fontH,fontWeight:700,fontSize:15,color:"#FFF",display:"flex",alignItems:"center",gap:5}}>
                          {headerText.length>22?headerText.slice(0,22)+"...":headerText}
                        </div>
                        <div style={{fontFamily:s.font,fontSize:11.5,color:"rgba(255,255,255,0.75)",display:"flex",alignItems:"center",gap:4}}>
                          <div style={{width:7,height:7,borderRadius:"50%",background:"#4ADE80"}} />{subText.length>30?subText.slice(0,30)+"...":subText}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Body */}
                  {previewState.id==="home" && (
                    <div style={{padding:14,background:`linear-gradient(180deg, rgba(${acRgb},0.016) 0%, transparent 60%)`}}>
                      {starters.filter(st=>st.active).slice(0,4).map((st,i)=>(
                        <div key={st.id} style={{
                          display:"flex",alignItems:"center",gap:8,padding:"11px 12px",borderRadius:10,marginBottom:6,
                          background:i===0?`rgba(${acRgb},0.03)`:"#FAFAF8",border:i===0?`1px solid rgba(${acRgb},0.08)`:"1px solid #F1F5F9",cursor:"pointer",
                        }}>
                          <span style={{fontFamily:s.font,fontSize:12.5,fontWeight:500,color:"#1A1D23"}}>{st.text}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {previewState.id==="chat" && (
                    <div style={{padding:14,minHeight:widgetSize.id==="compact"?140:widgetSize.id==="large"?240:190,position:"relative",background:`linear-gradient(180deg, rgba(${acRgb},0.02) 0%, rgba(${acRgb},0.008) 40%, transparent 100%)`,transition:"min-height 0.3s ease"}}>
                      {bgPattern.pattern && <div style={{position:"absolute",inset:0,backgroundImage:bgPattern.pattern,backgroundSize:bgPattern.size||(bgPattern.id==="grid"?"16px 16px":"8px 8px"),color:`rgba(${acRgb},0.13)`,pointerEvents:"none"}} />}
                      <div style={{position:"relative",zIndex:1}}>
                        {/* AI Agent Label */}
                        {aiLabel && <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:5}}>
                          <div style={{width:20,height:20,borderRadius:6,background:`linear-gradient(135deg,${ac},${ad})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9}}>🤖</div>
                          <span style={{fontFamily:s.fontH,fontSize:10,fontWeight:700,color:ac}}>{aiName}</span>
                          <span style={{fontSize:8,fontWeight:700,padding:"2px 6px",borderRadius:4,background:`rgba(${acRgb},0.07)`,color:ac}}>AI Agent</span>
                        </div>}
                        <ChatBubble isAgent text={aiWelcome.length>40?aiWelcome.slice(0,40)+"...":aiWelcome} color={ac} dark={ad} avatar={botAvatar} />
                        <ChatBubble text="Fiyatlandırma hakkında bilgi alabilir miyim?" color={ac} dark={ad} />
                        <ChatBubble isAgent text={aiTone==="professional"?"Elbette, hemen yardımcı olayım.":aiTone==="humorous"?"Tabii ki! Hemen bakıyorum 🚀😄":aiTone==="neutral"?"Tabii, size yardımcı olayım.":`Tabii! Size hemen yardımcı olayım ${aiEmoji?"😊":""}`} color={ac} dark={ad} avatar={agentAvatar} />
                        {aiSuggestions && (
                          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:6}}>
                            {["💰 Planları gör","📞 İletişim","📦 Kargo bilgisi"].map((s2,i)=>(
                              <div key={i} style={{fontSize:10.5,fontWeight:700,padding:"6px 10px",borderRadius:9,background:`linear-gradient(135deg, rgba(${acRgb},0.07), rgba(${acRgb},0.024))`,border:`1.5px solid rgba(${acRgb},0.12)`,color:ac,fontFamily:s.fontH,cursor:"pointer",letterSpacing:"-0.01em",boxShadow:`0 1px 3px rgba(${acRgb},0.06)`}}>{s2}</div>
                            ))}
                          </div>
                        )}
                        {typingIndicator && (
                          <div style={{display:"flex",alignItems:"center",gap:6,padding:"7px 12px",borderRadius:10,background:"#F3F4F6",width:"fit-content",marginTop:6}}>
                            <div style={{display:"flex",gap:3}}>{[0,1,2].map(d=><div key={d} style={{width:5,height:5,borderRadius:"50%",background:"#94A3B8",animation:`pulse 1s ${d*0.2}s infinite`}} />)}</div>
                            <span style={{fontSize:9,color:"#94A3B8"}}>yazıyor...</span>
                          </div>
                        )}
                      </div>
                      <div style={{marginTop:12,display:"flex",gap:7,alignItems:"center",padding:"9px 12px",borderRadius:11,border:"1.5px solid #E8E0D4",background:"#FFFCF8",position:"relative",zIndex:1}}>
                        {emojiPicker && <span style={{fontSize:14,cursor:"pointer"}}>😊</span>}
                        <div style={{flex:1,fontFamily:s.font,fontSize:12,color:"#94A3B8"}}>Mesajınızı yazın...</div>
                        {fileUpload && <span style={{fontSize:12,cursor:"pointer",color:"#CBD5E1"}}>📎</span>}
                        <div style={{width:28,height:28,borderRadius:8,background:`linear-gradient(135deg,${ac},${ad})`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                        </div>
                      </div>
                    </div>
                  )}

                  {previewState.id==="prechat" && (
                    <div style={{padding:12}}>
                      <div style={{fontFamily:s.fontH,fontSize:14,fontWeight:700,color:"#1A1D23",marginBottom:12}}>Bilgilerinizi girin</div>
                      {["Ad Soyad","Email"].map((f,i)=>(
                        <div key={f} style={{marginBottom:8}}>
                          <label style={{fontFamily:s.font,fontSize:11.5,fontWeight:600,color:"#64748B",display:"block",marginBottom:4}}>{f} *</label>
                          <div style={{height:36,borderRadius:8,border:"1.5px solid #E8E0D4",background:"#FFFCF8"}} />
                        </div>
                      ))}
                      <div style={{marginTop:4,padding:"10px",borderRadius:9,textAlign:"center",background:`linear-gradient(135deg,${ac},${ad})`,fontFamily:s.fontH,fontSize:12.5,fontWeight:700,color:"#FFF"}}>Sohbete Başla</div>
                    </div>
                  )}

                  {previewState.id==="offline" && (
                    <div style={{padding:16,textAlign:"center"}}>
                      <div style={{fontSize:34,marginBottom:8}}>🌙</div>
                      <div style={{fontFamily:s.fontH,fontSize:15,fontWeight:700,color:"#1A1D23",marginBottom:6}}>Çevrimdışıyız</div>
                      <div style={{fontFamily:s.font,fontSize:12,color:"#64748B",lineHeight:1.5,marginBottom:14}}>{offlineMsg.length>60?offlineMsg.slice(0,60)+"...":offlineMsg}</div>
                      <div style={{padding:"10px",borderRadius:9,border:`1.5px solid rgba(${acRgb},0.19)`,background:`rgba(${acRgb},0.02)`,fontFamily:s.fontH,fontSize:12.5,fontWeight:700,color:ac}}>✉️ Mesaj Bırak</div>
                      {hoursEnabled && (
                        <div style={{marginTop:10,fontFamily:s.font,fontSize:9,color:"#94A3B8"}}>
                          ⏰ {hours.find(h=>h.on)? `Çalışma saatleri: ${hours.find(h=>h.on).start} - ${hours.find(h=>h.on).end}` : "Yarın tekrar deneyin"}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Footer - Premium Branding */}
                  {showBranding && (
                    <div style={{padding:"9px 14px",borderTop:`1px solid rgba(${acRgb},0.06)`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,padding:"4px 12px 4px 8px",borderRadius:20,background:`rgba(${acRgb},0.04)`,border:`1px solid rgba(${acRgb},0.06)`}}>
                        <div style={{width:16,height:16,borderRadius:5,background:`linear-gradient(135deg,${ac},${ad})`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="white"/></svg>
                        </div>
                        <span style={{fontFamily:s.fontH,fontSize:10.5,fontWeight:600,color:"#9CA3AF",letterSpacing:"0.01em"}}>Powered by <span style={{fontWeight:800,color:ac}}>Helvion</span></span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              </div>
            )}
          </div>

          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:5,marginTop:10}}>
            <div style={{width:5,height:5,borderRadius:"50%",background:ac,transition:"background 0.5s"}} />
            <span style={{fontFamily:s.font,fontSize:10,color:"#94A3B8"}}>Ayarlar değiştikçe önizleme otomatik güncellenir</span>
          </div>
        </div>
      </div>
    </div>
  );
}
