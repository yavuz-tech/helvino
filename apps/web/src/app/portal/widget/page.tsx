"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import LoadingFallback from "@/components/LoadingFallback";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import ErrorBanner from "@/components/ErrorBanner";
import { portalApiFetch } from "@/lib/portal-auth";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { Copy, Check, Plus, Trash2, Globe, Wifi, WifiOff, ChevronLeft, ChevronDown, ChevronRight } from "lucide-react";
import WidgetGallery from "@/components/widget/WidgetGallery";

interface WidgetConfig {
  widgetEnabled: boolean;
  allowedDomains: string[];
  allowLocalhost: boolean;
  embedSnippet: { html: string; scriptSrc: string; siteId: string };
  lastWidgetSeenAt: string | null;
  health: {
    status: "OK" | "NEEDS_ATTENTION" | "NOT_CONNECTED";
    failuresTotal: number;
    domainMismatchTotal: number;
  };
  requestId?: string;
}

type InstallPlatformId =
  | "html"
  | "wordpress"
  | "react"
  | "vue"
  | "shopify"
  | "wix"
  | "webflow"
  | "gtm";

type InstallPlatform = {
  id: InstallPlatformId;
  name: string;
  letter: string;
  color: string;
};

const CARD_STYLE: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #E8E5DE",
  borderRadius: 14,
  padding: "20px 24px",
};

const CARD_TITLE_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontSize: 16,
  fontWeight: 800,
  lineHeight: 1.2,
  color: "#292524",
};

const CARD_SUBTITLE_STYLE: React.CSSProperties = {
  marginTop: 6,
  fontFamily: "var(--font-body)",
  fontSize: 13,
  color: "#78716C",
};

const CODE_BLOCK_STYLE: React.CSSProperties = {
  background: "#1C1917",
  border: "1px solid #292524",
  borderRadius: 12,
  padding: 16,
  overflow: "hidden",
  position: "relative",
  boxShadow: "0 6px 24px rgba(0,0,0,0.10)",
};

const CODE_PRE_STYLE: React.CSSProperties = {
  margin: 0,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'JetBrains Mono', 'Liberation Mono', monospace",
  fontSize: 12.5,
  lineHeight: 1.55,
  color: "#E7E5E4",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

const INSTALL_PLATFORMS: InstallPlatform[] = [
  { id: "html", name: "HTML", letter: "H", color: "#E44D26" },
  { id: "wordpress", name: "WordPress", letter: "W", color: "#21759B" },
  { id: "react", name: "React / Next.js", letter: "R", color: "#61DAFB" },
  { id: "vue", name: "Vue / Nuxt", letter: "V", color: "#42B883" },
  { id: "shopify", name: "Shopify", letter: "S", color: "#96BF48" },
  { id: "wix", name: "Wix", letter: "X", color: "#FAAD4D" },
  { id: "webflow", name: "Webflow", letter: "F", color: "#4353FF" },
  { id: "gtm", name: "GTM", letter: "G", color: "#4285F4" },
];

function InstallationGuide({
  embedHtml,
  scriptSrc,
  siteId,
}: {
  embedHtml: string;
  scriptSrc: string;
  siteId: string;
}) {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<InstallPlatformId>("html");

  const activePlatform = INSTALL_PLATFORMS.find((p) => p.id === platform) || INSTALL_PLATFORMS[0]!;

  const embedForEcho = (embedHtml || "").trim() || "[standart embed kodu]";
  const cdnUrl = (scriptSrc || "").trim() || "[CDN_URL]";

  const platformCode = (() => {
    if (platform === "wordpress") {
      return [
        "// functions.php EN SONUNA ekleyin",
        "function helvion_chat_widget() {",
        `  echo '${embedForEcho.replace(/'/g, "\\'")}';`,
        "}",
        "add_action('wp_footer', 'helvion_chat_widget');",
      ].join("\n");
    }
    if (platform === "react") {
      return [
        '"use client";',
        'import { useEffect } from "react";',
        "",
        "export default function HelvionWidget() {",
        "  useEffect(() => {",
        '    if (document.getElementById("hv-w")) return;',
        "    var el = document.createElement(\"script\");",
        "    el.id = \"hv-w\";",
        `    el.src = \"${cdnUrl}\";`,
        "    el.async = true;",
        `    el.setAttribute(\"data-site\", \"${siteId}\");`,
        "    document.body.appendChild(el);",
        "    return () => el.remove();",
        "  }, []);",
        "  return null;",
        "}",
      ].join("\n");
    }
    if (platform === "vue") {
      return [
        'import { onMounted } from "vue";',
        "",
        "onMounted(() => {",
        '  if (document.getElementById("hv-w")) return;',
        "  var el = document.createElement(\"script\");",
        "  el.id = \"hv-w\";",
        `  el.src = \"${cdnUrl}\";`,
        "  el.async = true;",
        `  el.setAttribute(\"data-site\", \"${siteId}\");`,
        "  document.body.appendChild(el);",
        "});",
      ].join("\n");
    }
    return "";
  })();

  const steps: Record<InstallPlatformId, Array<{ title: string; desc: string }>> = {
    html: [
      { title: "Yukaridaki kodu kopyalayin", desc: "Kodu Kopyala butonuna tiklayin." },
      { title: "HTML dosyanizi acin", desc: "index.html veya index.php dosyasini editorunuzde acin." },
      { title: "</body> etiketini bulun", desc: "Ctrl+F ile body aratarak bulabilirsiniz." },
      { title: "Kodu </body> satirinin USTUNE yapistirin", desc: "Onemli: Altina degil, ustune." },
      { title: "Kaydedin", desc: "Ctrl+S veya hosting panelindeki Kaydet." },
      { title: "Tarayicida kontrol edin", desc: "Sag altta sohbet balonu gorunecek." },
    ],
    wordpress: [
      { title: "wp-admin'e giris yapin", desc: "siteniz.com/wp-admin" },
      { title: "Gorunum > Tema Dosya Duzenleyicisi", desc: "Sol menuden Gorunum'u secin." },
      { title: "functions.php dosyasini secin", desc: "Sag taraftaki listeden tiklayin." },
      { title: "Dosyanin EN SONUNA gidin", desc: "En alta kaydirin." },
      { title: "WordPress kodunu yapistirin", desc: "Mevcut kodlari silmeyin!" },
      { title: "Dosyayi Guncelle", desc: "Alttaki mavi buton." },
      { title: "Sitenizi kontrol edin", desc: "Cache eklentiniz varsa temizleyin." },
      { title: "Alternatif: WPCode eklentisi", desc: "Eklentiler > Yeni Ekle > WPCode arayin, Footer'a yapistirin." },
    ],
    react: [
      { title: "Component olusturun", desc: "components/ icinde HelvionWidget.tsx" },
      { title: "React kodunu yapistirin", desc: "Ozel React kodunu dosyaya yapistirin." },
      { title: "use client kontrolu", desc: "Next.js App Router icin zorunlu." },
      { title: "Layout'a ekleyin", desc: "app/layout.tsx icinde import edip return icine koyun." },
      { title: "Test edin", desc: "npm run dev ile baslatin." },
    ],
    vue: [
      { title: "Component olusturun", desc: "components/HelvionWidget.vue" },
      { title: "Vue kodunu yapistirin", desc: "Ozel Vue kodunu yapistirin." },
      { title: "Layout'a ekleyin", desc: "App.vue veya layouts/default.vue" },
      { title: "Test edin", desc: "npm run dev" },
    ],
    shopify: [
      { title: "Shopify Admin'e girin", desc: "myshopify.com/admin" },
      { title: "Online Store > Themes", desc: "Sol menuden tiklayin." },
      { title: "Edit Code secin", desc: "Aktif temanin yanindaki ... > Edit Code" },
      { title: "theme.liquid acin", desc: "Layout altindan tiklayin." },
      { title: "body oncesine kodu yapistirin", desc: "Ctrl+F ile body arayin." },
      { title: "Save tiklayin", desc: "Sag ustteki yesil buton." },
      { title: "Magazanizi kontrol edin", desc: "Yeni sekmede acin." },
    ],
    wix: [
      { title: "Wix Dashboard'a girin", desc: "wix.com'a giris yapin." },
      { title: "Settings > Custom Code", desc: "Advanced bolumunde." },
      { title: "+ Add Custom Code", desc: "Sag ustteki buton." },
      { title: "Kodu yapistirin", desc: "Acilan alana HTML kodunu yapistirin." },
      { title: "Ayarlar: Body-end, All pages", desc: "Yerlesim ve sayfa secimi." },
      { title: "Apply ve Publish", desc: "Kaydedin ve yayinlayin." },
    ],
    webflow: [
      { title: "Project Settings acin", desc: "Projenizi acin." },
      { title: "Custom Code sekmesi", desc: "Ust menuden tiklayin." },
      { title: "Footer Code'a yapistirin", desc: "Save Changes." },
      { title: "Publish edin", desc: "Designer'dan yayinlayin." },
    ],
    gtm: [
      { title: "GTM'e girin", desc: "tagmanager.google.com" },
      { title: "Yeni Etiket > Ozel HTML", desc: "Etiketler > Yeni" },
      { title: "Kodu yapistirin", desc: "HTML kutusuna yapistirin." },
      { title: "Tetikleyici: All Pages", desc: "Tetikleme > All Pages" },
      { title: "Onizle ve Yayinla", desc: "Preview ile test, Submit > Publish" },
    ],
  };

  const stepItems = steps[platform] || steps.html;

  return (
    <div style={CARD_STYLE}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={CARD_TITLE_STYLE}>Kurulum Rehberi</div>
          <div style={CARD_SUBTITLE_STYLE}>
            Yerleştirme kodunu nereye ekleyeceğinizi adım adım gösterir.
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: "8px 10px",
            borderRadius: 10,
            color: "#B45309",
            fontFamily: "var(--font-heading)",
            fontWeight: 800,
            fontSize: 13,
          }}
          aria-expanded={open}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 18, display: "inline-flex", justifyContent: "center" }}>{open ? "▼" : "▶"}</span>
            Nereye yapistirmam gerekiyor? Adim adim rehber
          </span>
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 16 }}>
          {/* Platform selector */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {INSTALL_PLATFORMS.map((p) => {
              const selected = p.id === platform;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlatform(p.id)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: `1.5px solid ${selected ? p.color : "rgba(0,0,0,0.12)"}`,
                    background: selected ? "#fff" : "transparent",
                    cursor: "pointer",
                    boxShadow: selected ? "0 6px 18px rgba(0,0,0,0.06)" : "none",
                    transition: "all 150ms ease",
                  }}
                >
                  <span
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 9,
                      background: selected ? p.color : "rgba(0,0,0,0.06)",
                      color: selected ? "#fff" : "#292524",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "var(--font-heading)",
                      fontWeight: 900,
                      fontSize: 12,
                    }}
                  >
                    {p.letter}
                  </span>
                  <span style={{ fontFamily: "var(--font-body)", fontWeight: 800, fontSize: 13, color: "#292524" }}>
                    {p.name}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Platform-specific code */}
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ fontFamily: "var(--font-heading)", fontWeight: 900, fontSize: 14, color: "#292524" }}>
                Kod
              </div>
              <div style={{ fontFamily: "var(--font-body)", fontSize: 12.5, color: "#A8A29E" }}>
                Seçili platform: <span style={{ fontWeight: 800, color: activePlatform.color }}>{activePlatform.name}</span>
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              {platformCode ? (
                <div style={CODE_BLOCK_STYLE}>
                  <div style={{ position: "absolute", inset: "0 auto 0 0", width: 3, background: activePlatform.color }} />
                  <pre style={{ ...CODE_PRE_STYLE, paddingLeft: 10 }}>{platformCode}</pre>
                </div>
              ) : (
                <div style={CODE_BLOCK_STYLE}>
                  <div style={{ position: "absolute", inset: "0 auto 0 0", width: 3, background: "#F59E0B" }} />
                  <pre style={{ ...CODE_PRE_STYLE, paddingLeft: 10 }}>{(embedHtml || "").trim()}</pre>
                </div>
              )}
            </div>
          </div>

          {/* Timeline steps */}
          <div style={{ marginTop: 18 }}>
            <div style={{ fontFamily: "var(--font-heading)", fontWeight: 900, fontSize: 14, color: "#292524" }}>
              Adim adim
            </div>
            <div style={{ marginTop: 10, position: "relative" }}>
              <div
                style={{
                  position: "absolute",
                  left: 13,
                  top: 12,
                  bottom: 12,
                  width: 2,
                  background: "linear-gradient(180deg, rgba(245,158,11,0.95), rgba(245,158,11,0))",
                }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {stepItems.map((s, idx) => (
                  <div key={`${platform}_${idx}`} style={{ display: "flex", gap: 12, position: "relative" }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 999,
                        background: "linear-gradient(135deg, #F59E0B, #D97706)",
                        color: "#fff",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: "var(--font-heading)",
                        fontWeight: 900,
                        fontSize: 12.5,
                        flexShrink: 0,
                        boxShadow: "0 6px 16px rgba(245,158,11,0.25)",
                      }}
                    >
                      {idx + 1}
                    </div>
                    <div style={{ paddingTop: 1 }}>
                      <div style={{ fontFamily: "var(--font-heading)", fontWeight: 900, fontSize: 13.5, color: "#292524" }}>
                        {s.title}
                      </div>
                      <div style={{ marginTop: 2, fontFamily: "var(--font-body)", fontSize: 12.5, color: "#78716C", lineHeight: 1.5 }}>
                        {s.desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WidgetFaq() {
  const items: Array<{ q: string; a: string }> = [
    { q: "Site hizimi etkiler mi?", a: "Hayir. Async yuklenir, 45KB gzip, global CDN." },
    { q: "Birden fazla site?", a: "Evet. Her site icin ayri Site ID." },
    { q: "Gorunumu nasil degistiririm?", a: "Portal > Widget Gorunumu > 50+ ayar." },
    { q: "Belirli sayfalarda gizleyebilir miyim?", a: "Portal > Sayfa Kurallari." },
    { q: "Widget yuklenmiyor?", a: "1. Hard refresh 2. Site ID kontrol 3. body oncesi mi 4. F12 konsol 5. Canli destek." },
  ];

  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <div style={CARD_STYLE}>
      <div style={CARD_TITLE_STYLE}>Sikca Sorulan Sorular</div>
      <div style={CARD_SUBTITLE_STYLE}>Kurulum ve genel kullanimla ilgili hizli yanitlar</div>

      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((it, idx) => {
          const open = openIdx === idx;
          return (
            <div
              key={it.q}
              style={{
                border: "1px solid rgba(0,0,0,0.10)",
                borderRadius: 14,
                overflow: "hidden",
                background: open ? "rgba(255,251,235,0.55)" : "#fff",
              }}
            >
              <button
                type="button"
                onClick={() => setOpenIdx((v) => (v === idx ? null : idx))}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "14px 14px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                }}
                aria-expanded={open}
              >
                <div style={{ fontFamily: "var(--font-heading)", fontWeight: 900, fontSize: 13.5, color: "#292524" }}>
                  {it.q}
                </div>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: open ? "linear-gradient(135deg, #F59E0B, #D97706)" : "rgba(0,0,0,0.06)",
                    color: open ? "#fff" : "#78716C",
                    transform: open ? "rotate(45deg)" : "rotate(0deg)",
                    transition: "all 180ms ease",
                    fontFamily: "var(--font-heading)",
                    fontWeight: 900,
                  }}
                  aria-hidden="true"
                >
                  +
                </div>
              </button>
              {open && (
                <div style={{ padding: "0 14px 14px 14px" }}>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: 12.8, color: "#78716C", lineHeight: 1.6, fontWeight: 650 }}>
                    {it.a}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HelpCtaBanner({ onStartSupport }: { onStartSupport: () => void }) {
  return (
    <div
      style={{
        ...CARD_STYLE,
        background: "linear-gradient(135deg, #FFFBEB, #FEF3C7)",
        borderColor: "#FDE68A",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div style={{ minWidth: 240 }}>
        <div style={{ ...CARD_TITLE_STYLE, fontSize: 16 }}>Kurulumda yardima mi ihtiyaciniz var?</div>
        <div style={{ ...CARD_SUBTITLE_STYLE, marginTop: 4 }}>
          Teknik ekibimiz widget kurulumunu sizin icin ucretsiz gerceklestirir.
        </div>
      </div>
      <button
        type="button"
        onClick={onStartSupport}
        style={{
          border: "none",
          cursor: "pointer",
          padding: "12px 16px",
          borderRadius: 12,
          background: "linear-gradient(135deg, #F59E0B, #D97706)",
          color: "#fff",
          fontFamily: "var(--font-heading)",
          fontWeight: 900,
          fontSize: 13,
          boxShadow: "0 10px 24px rgba(245,158,11,0.25)",
        }}
      >
        Canli Destek Baslat
      </button>
    </div>
  );
}

function PortalWidgetContent() {
  const { user, loading: authLoading } = usePortalAuth();
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const showDebug = process.env.NODE_ENV === "development" && searchParams.get("debug") === "1";
  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [addingDomain, setAddingDomain] = useState(false);
  const [removingDomain, setRemovingDomain] = useState<string | null>(null);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [justAddedDomain, setJustAddedDomain] = useState<string | null>(null);
  const [animatedFailures, setAnimatedFailures] = useState(0);
  const [animatedMismatches, setAnimatedMismatches] = useState(0);

  const [showGallery, setShowGallery] = useState(false);
  const canEdit = user?.role === "owner" || user?.role === "admin";

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await portalApiFetch("/portal/widget/config");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setRequestId(data?.requestId || res.headers.get("x-request-id"));
        throw new Error(data?.error?.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setConfig(data);
      setRequestId(data.requestId || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!authLoading && user) fetchConfig();
  }, [authLoading, user, fetchConfig]);

  const copySnippet = async () => {
    if (!config) return;
    await navigator.clipboard.writeText(config.embedSnippet.html);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleAddDomain = async () => {
    if (!newDomain.trim() || addingDomain) return;
    const domainToAdd = newDomain.trim();
    setAddingDomain(true);
    setDomainError(null);
    setMessage(null);
    try {
      const res = await portalApiFetch("/portal/widget/domains", {
        method: "POST",
        body: JSON.stringify({ domain: domainToAdd }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error?.message || `HTTP ${res.status}`;
        setDomainError(msg);
        return;
      }
      setNewDomain("");
      setJustAddedDomain(domainToAdd);
      setMessage(t("domainAllowlist.added"));
      await fetchConfig();
    } catch (err) {
      setDomainError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setAddingDomain(false);
    }
  };

  useEffect(() => {
    if (!justAddedDomain) return;
    const timeout = setTimeout(() => setJustAddedDomain(null), 600);
    return () => clearTimeout(timeout);
  }, [justAddedDomain]);

  useEffect(() => {
    if (!config) return;
    const duration = 1000;
    let raf = 0;
    let raf2 = 0;
    const start = performance.now();
    const start2 = performance.now();
    const fromFailures = 0;
    const fromMismatches = 0;
    const toFailures = config.health.failuresTotal;
    const toMismatches = config.health.domainMismatchTotal;

    const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
    const tickFailures = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = easeOut(progress);
      setAnimatedFailures(Math.round(fromFailures + (toFailures - fromFailures) * eased));
      if (progress < 1) raf = requestAnimationFrame(tickFailures);
    };
    const tickMismatches = (now: number) => {
      const progress = Math.min((now - start2) / duration, 1);
      const eased = easeOut(progress);
      setAnimatedMismatches(Math.round(fromMismatches + (toMismatches - fromMismatches) * eased));
      if (progress < 1) raf2 = requestAnimationFrame(tickMismatches);
    };

    raf = requestAnimationFrame(tickFailures);
    raf2 = requestAnimationFrame(tickMismatches);
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(raf2);
    };
  }, [config?.health.failuresTotal, config?.health.domainMismatchTotal, config]);

  const handleRemoveDomain = async (domain: string) => {
    setRemovingDomain(domain);
    setDomainError(null);
    setMessage(null);
    try {
      const res = await portalApiFetch("/portal/widget/domains", {
        method: "DELETE",
        body: JSON.stringify({ domain }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDomainError(data?.error?.message || `HTTP ${res.status}`);
        return;
      }
      setMessage(t("domainAllowlist.removed"));
      await fetchConfig();
    } catch (err) {
      setDomainError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setRemovingDomain(null);
    }
  };

  const handleToggleWidget = async () => {
    if (!config) return;
    setMessage(null);
    try {
      const res = await portalApiFetch("/portal/widget/config", {
        method: "PATCH",
        body: JSON.stringify({ widgetEnabled: !config.widgetEnabled }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error?.message || `HTTP ${res.status}`);
        return;
      }
      await fetchConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    );
  }

  return (
    <>
      <div className="mb-5">
        <Link
          href="/portal"
          className="mb-2.5 inline-flex items-center gap-1 font-[var(--font-body)] text-[13px] font-medium text-[#94A3B8] transition-colors hover:text-[#64748B] group"
        >
          <ChevronLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" strokeWidth={2} />
          {t("portalOnboarding.backToDashboard")}
        </Link>
        <h1 className="font-[var(--font-heading)] text-[28px] font-extrabold leading-tight text-[#1A1D23]">{t("widgetSettings.title")}</h1>
        <p className="mt-1 font-[var(--font-body)] text-[14px] text-[#64748B]">{t("widgetSettings.subtitle")}</p>
      </div>

      {error && (
        <ErrorBanner
          message={error}
          requestId={requestId}
          onDismiss={() => setError(null)}
          className="mb-4"
        />
      )}

      {message && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200/80 rounded-lg p-3 text-[13px] text-emerald-700 font-medium shadow-sm">
          {message}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-500 text-[13px]">{t("common.loading")}</div>
      ) : config ? (
        <div className="space-y-5">
          {/* Widget Status + Toggle */}
          <div className="widget-card rounded-2xl border border-[#F3E8D8] bg-white p-6 shadow-sm widget-stagger" style={{ ["--index" as string]: 0 }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {config.widgetEnabled ? (
                  <div className="widget-status-icon widget-status-icon-ok flex h-12 w-12 items-center justify-center rounded-xl shadow-sm">
                    <Wifi size={18} className="text-emerald-600" strokeWidth={2} />
                  </div>
                ) : (
                  <div className="widget-status-icon widget-status-icon-off flex h-12 w-12 items-center justify-center rounded-xl shadow-sm">
                    <WifiOff size={18} className="text-red-500" strokeWidth={2} />
                  </div>
                )}
                <div>
                  <h2 className="font-[var(--font-heading)] text-[16px] font-bold leading-tight text-[#1A1D23]">
                    {config.widgetEnabled ? t("widgetSettings.widgetEnabled") : t("widgetSettings.widgetDisabled")}
                  </h2>
                  <p className="mt-0.5 flex items-center gap-2 font-[var(--font-body)] text-[12.5px]">
                    <span className={`h-2 w-2 rounded-full ${
                      config.health.status === "OK"
                        ? "status-dot-ok"
                        : config.health.status === "NOT_CONNECTED"
                        ? "status-dot-off"
                        : "status-dot-warn"
                    }`} />
                    <span className="text-[#94A3B8]">{t("widgetSettings.connectionStatus")}:</span>{" "}
                    <span className={`font-semibold ${
                      config.health.status === "OK" ? "text-emerald-600"
                      : config.health.status === "NEEDS_ATTENTION" ? "text-amber-600"
                      : "text-[#EF4444]"
                    }`}>
                      {config.health.status.replace(/_/g, " ")}
                    </span>
                  </p>
                </div>
              </div>
              {canEdit && (
                <button
                  onClick={handleToggleWidget}
                  className={`widget-button-press rounded-xl border-2 px-5 py-2.5 font-[var(--font-heading)] text-[13px] font-semibold transition-all ${
                    config.widgetEnabled
                      ? "border-[#EF4444] bg-transparent text-[#EF4444] hover:bg-[#EF4444] hover:text-white hover:shadow-[0_4px_16px_rgba(239,68,68,0.25)] hover:scale-[1.02]"
                      : "border-emerald-500 bg-transparent text-emerald-600 hover:bg-emerald-500 hover:text-white hover:shadow-[0_4px_16px_rgba(16,185,129,0.25)] hover:scale-[1.02]"
                  }`}
                >
                  {config.widgetEnabled ? t("widgetSettings.disableWidget") : t("widgetSettings.enableWidget")}
                </button>
              )}
            </div>

            {/* Health stats */}
            <div className="grid grid-cols-3 gap-4 border-t border-slate-200/80 pt-4">
              <div className="group text-center">
                <div className="font-[var(--font-body)] text-[12px] font-medium text-[#94A3B8]" suppressHydrationWarning>{t("widgetSettings.lastSeen")}</div>
                <div className="mt-1 font-[var(--font-heading)] text-[18px] font-bold text-[#1A1D23] transition-colors duration-300 group-hover:text-[#F59E0B]" suppressHydrationWarning>
                  {config.lastWidgetSeenAt ? new Date(config.lastWidgetSeenAt).toLocaleDateString() : "—"}
                </div>
              </div>
              <div className="group border-x border-[#F3E8D8] text-center">
                <div className="font-[var(--font-body)] text-[12px] font-medium text-[#94A3B8]">{t("widgetSettings.failures")}</div>
                <div className={`mt-1 font-[var(--font-heading)] text-[18px] font-bold transition-colors duration-300 group-hover:text-[#F59E0B] ${
                  config.health.failuresTotal > 0 ? "text-red-600" : "text-slate-800"
                }`}>
                  {animatedFailures}
                </div>
              </div>
              <div className="group text-center">
                <div className="font-[var(--font-body)] text-[12px] font-medium text-[#94A3B8]">{t("widgetSettings.domainMismatches")}</div>
                <div className={`mt-1 font-[var(--font-heading)] text-[18px] font-bold transition-colors duration-300 group-hover:text-[#F59E0B] ${
                  config.health.domainMismatchTotal > 0 ? "text-amber-600" : "text-slate-800"
                }`}>
                  {animatedMismatches}
                </div>
              </div>
            </div>
          </div>

          {/* Embed Snippet */}
          <div className="widget-card rounded-2xl border border-[#F3E8D8] bg-white p-6 shadow-sm widget-stagger" style={{ ["--index" as string]: 1 }}>
            <h2 className="mb-1 font-[var(--font-heading)] text-[16px] font-bold leading-tight text-[#1A1D23]">{t("widgetSettings.embedSnippet")}</h2>
            <p className="mb-4 font-[var(--font-body)] text-[13px] text-[#64748B]">{t("widgetSettings.embedHint")}</p>
            <div className="relative rounded-xl bg-[#1A1D23] p-4 shadow-sm">
              <div className="absolute inset-y-0 left-0 w-[3px] rounded-l-xl bg-[#F59E0B]" />
              <pre className="font-mono text-[13px] whitespace-pre-wrap break-all leading-relaxed text-[#E2E8F0] pl-2">
                {config.embedSnippet.html}
              </pre>
              <button
                onClick={copySnippet}
                className="absolute right-3 top-3 flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 font-[var(--font-body)] text-[12px] font-semibold text-white transition-all hover:scale-[1.05] hover:bg-white/20"
              >
                {copied ? <><Check size={13} className="text-emerald-400" /> <span className="text-emerald-400">✓ {t("widgetSettings.copied")}!</span></> : <><Copy size={13} /> {t("widgetSettings.copy")}</>}
              </button>
            </div>
          </div>

          {/* Installation Guide (NEW) — between embed snippet and allowlist */}
          <InstallationGuide
            embedHtml={config.embedSnippet.html}
            scriptSrc={config.embedSnippet.scriptSrc}
            siteId={config.embedSnippet.siteId}
          />

          {/* Domain Allowlist */}
          <div className="widget-card rounded-2xl border border-[#F3E8D8] bg-white p-6 shadow-sm widget-stagger" style={{ ["--index" as string]: 2 }}>
            <h2 className="mb-1 font-[var(--font-heading)] text-[16px] font-bold leading-tight text-[#1A1D23]">{t("domainAllowlist.title")}</h2>
            <p className="mb-4 font-[var(--font-body)] text-[13px] text-[#64748B]">{t("domainAllowlist.subtitle")}</p>

            {domainError && (
              <div className="mb-4 bg-red-50 border border-red-200/80 rounded-lg p-3 text-[13px] text-red-700 font-medium shadow-sm">
                {domainError}
              </div>
            )}

            {/* Add domain form */}
            {canEdit && (
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Globe size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddDomain(); }}
                    placeholder={t("domainAllowlist.addPlaceholder")}
                    className="w-full rounded-xl border border-black/10 bg-[#FAFAF8] py-3 pl-9 pr-3 font-[var(--font-body)] text-[13px] transition-all focus:border-[#F59E0B] focus:shadow-[0_0_0_3px_rgba(245,158,11,0.1)] focus:outline-none"
                  />
                </div>
                <button
                  onClick={handleAddDomain}
                  disabled={!newDomain.trim() || addingDomain}
                  className="widget-button-press flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#F59E0B] to-[#D97706] px-5 py-2.5 font-[var(--font-heading)] text-[13px] font-bold text-white shadow-[0_2px_8px_rgba(245,158,11,0.2)] transition-all hover:-translate-y-[1px] hover:shadow-[0_6px_20px_rgba(245,158,11,0.35)] disabled:opacity-50"
                >
                  <Plus size={15} strokeWidth={2.5} />
                  {addingDomain ? t("domainAllowlist.adding") : t("domainAllowlist.addDomain")}
                </button>
              </div>
            )}

            <p className="mb-4 font-[var(--font-body)] text-[12px] font-medium text-[#F59E0B]">{t("domainAllowlist.hint")}</p>

            {/* Domain list */}
            {config.allowedDomains.length === 0 ? (
              <div className="py-8 text-center">
                <Globe size={48} className="empty-float-icon mx-auto mb-3 text-[#D4D4D8]" strokeWidth={1.8} />
                <p className="font-[var(--font-heading)] text-[14px] font-semibold text-[#94A3B8]">{t("domainAllowlist.noDomains")}</p>
                <p className="mt-0.5 font-[var(--font-body)] text-[12.5px] text-[#C4C4C4]">{t("domainAllowlist.noDomainsDesc")}</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200/60">
                {config.allowedDomains.map((domain) => (
                  <div key={domain} className={`flex items-center justify-between py-2.5 ${justAddedDomain === domain ? "domain-item-enter" : ""}`}>
                    <div className="flex items-center gap-2">
                      <Globe size={15} className="text-slate-400" strokeWidth={2} />
                      <span className="text-[13px] font-mono text-slate-800 font-medium">{domain}</span>
                    </div>
                    {canEdit && (
                      <button
                        onClick={() => handleRemoveDomain(domain)}
                        disabled={removingDomain === domain}
                        className="flex items-center gap-1 px-2 py-1 text-[11px] text-red-600 hover:bg-red-50 rounded font-semibold transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={13} strokeWidth={2} />
                        {removingDomain === domain ? t("domainAllowlist.removing") : t("domainAllowlist.remove")}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* FAQ (NEW) */}
          <WidgetFaq />

          {/* Help CTA (NEW) */}
          <HelpCtaBanner onStartSupport={() => { try { window.location.href = "/portal/inbox"; } catch { /* */ } }} />

          {/* Widget Gallery (collapsible, default closed) - Only in dev + ?debug=1 */}
          {showDebug && (
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
              <button
                onClick={() => setShowGallery(!showGallery)}
                className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {showGallery ? (
                    <ChevronDown size={18} className="text-slate-500" />
                  ) : (
                    <ChevronRight size={18} className="text-slate-500" />
                  )}
                  <span className="text-sm font-semibold text-slate-700">
                    {t("widgetGallery.title")}
                  </span>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-medium rounded">
                    {t("widgetGallery.subtitle")}
                  </span>
                </div>
              </button>
              {showGallery && (
                <div className="px-5 pb-5">
                  <WidgetGallery />
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}
      <style jsx>{`
        .widget-stagger {
          opacity: 0;
          transform: translateY(20px);
          animation: fadeSlideUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
          animation-delay: calc(var(--index) * 100ms);
        }
        .widget-card {
          transition: all 0.3s ease;
        }
        .widget-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
        }
        .widget-status-icon {
          animation: softPulse 3s ease-in-out infinite;
        }
        .widget-status-icon-ok {
          background: rgba(16, 185, 129, 0.08);
        }
        .widget-status-icon-off {
          background: rgba(239, 68, 68, 0.06);
        }
        .status-dot-off {
          background: #ef4444;
          animation: blink 1.5s ease infinite;
        }
        .status-dot-warn {
          background: #f59e0b;
          box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.15);
        }
        .status-dot-ok {
          background: #10b981;
          box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.15);
        }
        .widget-button-press:active {
          transform: scale(0.98);
        }
        .domain-item-enter {
          animation: domainEnter 0.3s ease forwards;
        }
        .empty-float-icon {
          animation: float 3s ease-in-out infinite;
        }
        @keyframes fadeSlideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes softPulse {
          0%,
          100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.05);
            opacity: 0.85;
          }
        }
        @keyframes blink {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.3;
          }
        }
        @keyframes domainEnter {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-6px);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .widget-stagger,
          .widget-card,
          .widget-status-icon,
          .status-dot-off,
          .domain-item-enter,
          .empty-float-icon,
          .widget-button-press {
            animation: none !important;
            transition-duration: 0.01ms !important;
            transform: none !important;
          }
        }
      `}</style>
    </>
  );
}

export default function PortalWidgetPage() {
  return (
    <Suspense
      fallback={<LoadingFallback />}
    >
      <PortalWidgetContent />
    </Suspense>
  );
}
