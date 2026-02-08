/**
 * Widget Gallery Image Manifest (V2)
 * 
 * Central source of truth for all widget appearance examples.
 * Used across portal widget settings pages for visual previews.
 */

export type WidgetUsageType = 
  | 'launcher'           // Widget açılış bubble/icon
  | 'header'             // Sohbet üst başlık (avatars + title)
  | 'avatars'            // Müşteri hizmetleri avatarları
  | 'quickReplies'       // Hızlı yanıt butonları
  | 'inboxPreview'       // Mesaj listesi görünümü
  | 'mobilePreview'      // Mobil cihaz görünümü
  | 'chatThread'         // Sohbet akışı (mesajlar)
  | 'botHandoff'         // Bot'tan canlı agent'a geçiş
  | 'homeScreen'         // Ana karşılama ekranı
  | 'helpCenter'         // Yardım merkezi entegrasyonu
  | 'portalDashboard'    // Portal yönetim paneli
  | 'fullPreview';       // Tam ekran widget preview

export interface WidgetGalleryImage {
  id: string;
  title: string;
  description: string;
  src: string;
  width: number;
  height: number;
  tags: string[];
  usage: WidgetUsageType;  // V2: Widget UI'da hangi parçayı temsil ediyor
}

export const WIDGET_GALLERY_IMAGES: WidgetGalleryImage[] = [
  {
    id: "handoff-bot-to-person",
    title: "Bot'tan Kişiye Geçiş",
    description: "Kullanıcı bot'tan memnun kalmadığında canlı destek temsilcisine sorunsuz geçiş yapabilir. Profesyonel el değiştirme akışı.",
    src: "/widget-gallery/Desktop-2-214f48c2-4137-49a8-b455-6ea1bea26a7c.png",
    width: 1024,
    height: 768,
    tags: ["handoff", "live-agent", "bot", "conversation"],
    usage: "botHandoff"
  },
  {
    id: "messages-list",
    title: "Mesaj Listesi",
    description: "Kullanıcının tüm görüşmelerinin listelendiği ana mesajlaşma ekranı. Temiz ve modern görünüm.",
    src: "/widget-gallery/Desktop-9-f2c735f2-655c-4c01-8958-33abb4576a16.png",
    width: 1024,
    height: 768,
    tags: ["messages", "inbox", "list", "ui"],
    usage: "inboxPreview"
  },
  {
    id: "ai-bot-chat",
    title: "AI Bot Sohbet",
    description: "Yapay zeka destekli otomatik yanıtlar ve kaynak referansları ile zenginleştirilmiş bot sohbet deneyimi.",
    src: "/widget-gallery/Desktop-3-52b1dbe9-b1ab-4189-a076-461c7d69fbd8.png",
    width: 1024,
    height: 768,
    tags: ["ai", "bot", "chat", "automation"],
    usage: "chatThread"
  },
  {
    id: "unread-message-badge",
    title: "Okunmamış Mesaj Bildirimi",
    description: "Yeni mesajların görsel bildirimiyle kullanıcı etkileşimini artırın. Göze çarpan badge tasarımı.",
    src: "/widget-gallery/Desktop-7-bd80c5e3-8ee1-4290-b2cf-b02a19d5c2a1.png",
    width: 1024,
    height: 768,
    tags: ["notification", "badge", "unread", "ux"],
    usage: "launcher"
  },
  {
    id: "home-screen-default",
    title: "Ana Ekran",
    description: "Widget'ın ilk açıldığında gösterdiği karşılama ekranı. Kullanıcıyı yönlendiren CTA butonları.",
    src: "/widget-gallery/Desktop-4-3596079a-8aae-4660-9879-7a1efad32f5e.png",
    width: 1024,
    height: 768,
    tags: ["home", "welcome", "cta", "landing"],
    usage: "homeScreen"
  },
  {
    id: "bot-quick-replies",
    title: "Bot + Hızlı Yanıtlar",
    description: "Kullanıcılara önceden tanımlı hızlı yanıt seçenekleri sunarak sohbeti hızlandırın.",
    src: "/widget-gallery/Desktop-1-3e178a45-dc5b-40a5-b78f-888a9171b5c8.png",
    width: 1024,
    height: 768,
    tags: ["bot", "quick-replies", "suggestions", "ux"],
    usage: "quickReplies"
  },
  {
    id: "home-screen-expanded",
    title: "Ana Ekran (Geniş)",
    description: "Daha fazla içerik alanıyla genişletilmiş karşılama ekranı. Help center entegrasyonu ve arama.",
    src: "/widget-gallery/Desktop-5-1a2d2473-9301-4ace-8b52-c12857556bc2.png",
    width: 1024,
    height: 768,
    tags: ["home", "expanded", "help-center", "search"],
    usage: "homeScreen"
  },
  {
    id: "help-center",
    title: "Yardım Merkezi",
    description: "Entegre yardım merkezi ile SSS, kılavuzlar ve makale koleksiyonlarını doğrudan widget içinde sunun.",
    src: "/widget-gallery/Desktop-8-a4ef27ce-b474-43ef-9b32-8f6b67686a2c.png",
    width: 1024,
    height: 768,
    tags: ["help-center", "faq", "articles", "self-service"],
    usage: "helpCenter"
  },
  {
    id: "home-with-help",
    title: "Ana Ekran + Yardım",
    description: "Hem mesajlaşma hem de yardım merkezi erişimini bir arada sunan hibrit ana ekran düzeni.",
    src: "/widget-gallery/Desktop-6-aed6abeb-5759-4760-9ac6-75eef2d4eb11.png",
    width: 1024,
    height: 768,
    tags: ["home", "help", "hybrid", "navigation"],
    usage: "homeScreen"
  },
  {
    id: "customer-service-avatars",
    title: "Müşteri Hizmetleri Avatarları",
    description: "Widget başlığında görünen müşteri hizmetleri ekibi avatarları. Kişisel ve güvenilir görünüm.",
    src: "/widget-gallery/Desktop-4791bcae-e573-406c-86db-d247ca590479.png",
    width: 1024,
    height: 768,
    tags: ["avatars", "team", "header", "ui"],
    usage: "avatars"
  },
  {
    id: "news-feed",
    title: "Haberler & Güncellemeler",
    description: "Widget içinde ürün haberleri, güncellemeler ve duyuruları paylaşın.",
    src: "/widget-gallery/Desktop-10-d400859d-3406-4fae-9d17-838813bba3e3.png",
    width: 1024,
    height: 768,
    tags: ["news", "updates", "feed", "content"],
    usage: "fullPreview"
  },
  {
    id: "messages-desktop-alt",
    title: "Mesaj Listesi (Alternatif)",
    description: "Alternatif mesaj listesi tasarımı. Unread badge ve zaman damgası vurguları.",
    src: "/widget-gallery/Desktop-9-34026843-2d92-40de-a7c3-f8f5b5043bfe.png",
    width: 1024,
    height: 768,
    tags: ["messages", "inbox", "list", "desktop"],
    usage: "inboxPreview"
  },
  {
    id: "chatform-mobile-1",
    title: "Mobil Sohbet Formu (1)",
    description: "Mobil cihazlar için optimize edilmiş sohbet formu. Touch-friendly tasarım ve modern arayüz.",
    src: "/widget-gallery/Chatform_6-6a44121c-c823-4327-b49c-bd37f814d406.png",
    width: 375,
    height: 812,
    tags: ["mobile", "form", "chat", "responsive"],
    usage: "mobilePreview"
  },
  {
    id: "chatform-mobile-2",
    title: "Mobil Sohbet Formu (2)",
    description: "Alternatif mobil sohbet formu tasarımı. Farklı renk temaları ve düzen seçenekleri.",
    src: "/widget-gallery/Chatform_6-6d1af011-39ed-4a41-b664-a6e9e260e4e6.png",
    width: 375,
    height: 812,
    tags: ["mobile", "form", "chat", "theme"],
    usage: "mobilePreview"
  },
  {
    id: "chatform-mobile-3",
    title: "Mobil Sohbet Formu (3)",
    description: "Genişletilmiş form alanları ile daha detaylı bilgi toplama imkanı sunan mobil düzen.",
    src: "/widget-gallery/Chatform_6-71434b5c-d837-4dbc-b9df-e901d3a4b753.png",
    width: 375,
    height: 812,
    tags: ["mobile", "form", "extended", "fields"],
    usage: "mobilePreview"
  },
  {
    id: "chatform-mobile-4",
    title: "Mobil Sohbet Formu (4)",
    description: "Kompakt mobil form tasarımı. Minimum form alanı ile hızlı başlangıç.",
    src: "/widget-gallery/Chatform_6-a54af44e-00f3-4f12-8944-224eeb543b4a.png",
    width: 375,
    height: 812,
    tags: ["mobile", "form", "compact", "quick-start"],
    usage: "mobilePreview"
  },
  {
    id: "mobile-chat-1",
    title: "Mobil Sohbet Ekranı (1)",
    description: "Tam fonksiyonel mobil sohbet ekranı. Hızlı yanıtlar ve mesaj composer.",
    src: "/widget-gallery/Mobile-1-57bdd1cb-2b11-43b8-b138-2201835ab901.png",
    width: 375,
    height: 812,
    tags: ["mobile", "chat", "conversation", "full"],
    usage: "mobilePreview"
  },
  {
    id: "mobile-inbox",
    title: "Mobil Mesaj Listesi",
    description: "Mobil görünümde mesaj inbox. Unread badge ve navigasyon.",
    src: "/widget-gallery/Mobile-2-05562dc9-0481-4b81-ac3a-b580add7171e.png",
    width: 375,
    height: 812,
    tags: ["mobile", "inbox", "messages", "navigation"],
    usage: "mobilePreview"
  },
  {
    id: "mobile-quick-replies",
    title: "Mobil Hızlı Yanıtlar",
    description: "Mobil cihazda hızlı yanıt butonları. Touch-optimized layout.",
    src: "/widget-gallery/Mobile-3-bf4e532b-1bcd-4ed0-aacd-b8c2e3a83399.png",
    width: 375,
    height: 812,
    tags: ["mobile", "quick-replies", "buttons", "touch"],
    usage: "quickReplies"
  },
  {
    id: "mobile-handoff",
    title: "Mobil Bot Handoff",
    description: "Mobil görünümde bot'tan canlı agent'a geçiş akışı.",
    src: "/widget-gallery/Mobile-4-33adab1c-feed-463b-aa31-11384331413b.png",
    width: 375,
    height: 812,
    tags: ["mobile", "handoff", "bot", "agent"],
    usage: "botHandoff"
  },
  {
    id: "mobile-home",
    title: "Mobil Ana Ekran",
    description: "Mobil cihazlar için optimize edilmiş karşılama ekranı.",
    src: "/widget-gallery/Mobile-31375248-732a-42ce-8c77-6e4a3e3772fd.png",
    width: 375,
    height: 812,
    tags: ["mobile", "home", "welcome", "landing"],
    usage: "homeScreen"
  },
  {
    id: "ui-intro-guide",
    title: "Widget UI Rehberi",
    description: "Widget UI bileşenlerinin detaylı açıklaması ve kullanım kılavuzu. Geliştirici referansı.",
    src: "/widget-gallery/UI_Intro-0ea21865-1adb-4e9f-9215-9fdf0aadb398.png",
    width: 1920,
    height: 1080,
    tags: ["guide", "documentation", "components", "reference"],
    usage: "fullPreview"
  },
  {
    id: "inbox-multi-pane",
    title: "Inbox Çoklu Panel Görünümü",
    description: "Portal içi inbox sayfası için profesyonel çoklu panel düzeni. Filtreler, konuşma listesi ve detay paneli.",
    src: "/widget-gallery/Ekran_Resmi_2026-02-05_16.38.01-65fa18ee-0db1-471e-b9db-d949f6f7260f.png",
    width: 1920,
    height: 1080,
    tags: ["inbox", "portal", "multi-pane", "dashboard"],
    usage: "portalDashboard"
  },
  {
    id: "portal-widget-settings",
    title: "Portal Widget Ayarları",
    description: "Widget yapılandırma sayfası. Domain yönetimi, embed kodu ve durum kontrolleri.",
    src: "/widget-gallery/Ekran_Resmi_2026-02-06_00.06.06-72032af2-d7bc-4c4a-8cb7-43512caf2348.png",
    width: 1920,
    height: 1080,
    tags: ["portal", "settings", "config", "admin"],
    usage: "portalDashboard"
  },
  {
    id: "portal-overview",
    title: "Portal Ana Sayfa",
    description: "Portal dashboard ana görünümü. Hızlı aksiyonlar, kurulum görevleri ve özet bilgiler.",
    src: "/widget-gallery/Ekran_Resmi_2026-02-07_22.22.17-1252bfbb-fa91-4ff6-a127-b88c9ce83306.png",
    width: 1920,
    height: 1080,
    tags: ["portal", "dashboard", "overview", "admin"],
    usage: "portalDashboard"
  }
];

/**
 * Get image by ID
 */
export function getWidgetImageById(id: string): WidgetGalleryImage | undefined {
  return WIDGET_GALLERY_IMAGES.find(img => img.id === id);
}

/**
 * Filter images by tag
 */
export function getWidgetImagesByTag(tag: string): WidgetGalleryImage[] {
  return WIDGET_GALLERY_IMAGES.filter(img => img.tags.includes(tag));
}

/**
 * Filter images by usage type
 */
export function getWidgetImagesByUsage(usage: WidgetUsageType): WidgetGalleryImage[] {
  return WIDGET_GALLERY_IMAGES.filter(img => img.usage === usage);
}

/**
 * Get all unique tags
 */
export function getAllWidgetTags(): string[] {
  const tags = new Set<string>();
  WIDGET_GALLERY_IMAGES.forEach(img => img.tags.forEach(tag => tags.add(tag)));
  return Array.from(tags).sort();
}

/**
 * Get all usage types with their counts
 */
export function getAllUsageTypes(): Array<{ usage: WidgetUsageType; count: number; label: string }> {
  const usageCounts = new Map<WidgetUsageType, number>();
  
  WIDGET_GALLERY_IMAGES.forEach(img => {
    usageCounts.set(img.usage, (usageCounts.get(img.usage) || 0) + 1);
  });

  const usageLabels: Record<WidgetUsageType, string> = {
    launcher: "Widget Launcher",
    header: "Sohbet Başlığı",
    avatars: "Avatar Gösterimi",
    quickReplies: "Hızlı Yanıtlar",
    inboxPreview: "Mesaj Listesi",
    mobilePreview: "Mobil Görünüm",
    chatThread: "Sohbet Akışı",
    botHandoff: "Bot → Agent Geçişi",
    homeScreen: "Ana Ekran",
    helpCenter: "Yardım Merkezi",
    portalDashboard: "Portal Dashboard",
    fullPreview: "Tam Preview"
  };

  return Array.from(usageCounts.entries()).map(([usage, count]) => ({
    usage,
    count,
    label: usageLabels[usage]
  })).sort((a, b) => b.count - a.count);
}
