export type WidgetLang = "tr" | "en" | "es";

export function resolveWidgetLang(value: unknown): WidgetLang {
  const v = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (v === "tr" || v === "en" || v === "es") return v;
  return "tr";
}

type Key =
  | "loading"
  | "openChat"
  | "closeChat"
  | "emoji"
  | "attach"
  | "gif"
  | "send"
  | "typing"
  | "failedSend"
  | "aiBadge"
  | "poweredByLine"
  | "systemConversationClosed"
  | "systemAgentJoined"
  | "systemAiHandoff"
  | "chatDisabled"
  | "defaultTitle"
  | "defaultSubtitle"
  | "defaultPlaceholder"
  | "defaultWelcome"
  | "starterPricing"
  | "starterSupport"
  | "starterOrder"
  | "talkToAgent";

const DICT: Record<WidgetLang, Record<Key, string>> = {
  tr: {
    loading: "Yükleniyor...",
    openChat: "Sohbeti aç",
    closeChat: "Sohbeti kapat",
    emoji: "Emoji",
    attach: "Dosya ekle",
    gif: "GIF",
    send: "Gönder",
    typing: "yazıyor...",
    failedSend: "⚠︎ gönderilemedi",
    aiBadge: "AI",
    poweredByLine: "tarafından desteklenmektedir",
    systemConversationClosed: "Sohbet kapatıldı",
    systemAgentJoined: "Bir temsilci sohbete katıldı",
    systemAiHandoff: "AI sohbeti devraldı",
    chatDisabled: "Sohbet şu an kapalı",
    defaultTitle: "Nasıl yardımcı olabiliriz?",
    defaultSubtitle: "Genellikle birkaç dakika içinde yanıt veriyoruz",
    defaultPlaceholder: "Mesajınızı yazın...",
    defaultWelcome: "Merhaba! 👋 Size nasıl yardımcı olabilirim?",
    starterPricing: "💰 Fiyatlandırma hakkında bilgi",
    starterSupport: "🔧 Teknik destek istiyorum",
    starterOrder: "📦 Siparişimi takip etmek istiyorum",
    talkToAgent: "🧑‍💼 Temsilciye bağlan",
  },
  en: {
    loading: "Loading...",
    openChat: "Open chat",
    closeChat: "Close chat",
    emoji: "Emoji",
    attach: "Attach file",
    gif: "GIF",
    send: "Send",
    typing: "typing...",
    failedSend: "⚠︎ failed to send",
    aiBadge: "AI",
    poweredByLine: "Powered by",
    systemConversationClosed: "Chat closed",
    systemAgentJoined: "A human agent joined",
    systemAiHandoff: "AI took over the chat",
    chatDisabled: "Chat is currently disabled",
    defaultTitle: "How can we help?",
    defaultSubtitle: "We typically reply within minutes",
    defaultPlaceholder: "Write your message...",
    defaultWelcome: "Hi! 👋 How can we help you?",
    starterPricing: "💰 Pricing information",
    starterSupport: "🔧 I need technical support",
    starterOrder: "📦 Track my order",
    talkToAgent: "🧑‍💼 Talk to an agent",
  },
  es: {
    loading: "Cargando...",
    openChat: "Abrir chat",
    closeChat: "Cerrar chat",
    emoji: "Emoji",
    attach: "Adjuntar archivo",
    gif: "GIF",
    send: "Enviar",
    typing: "escribiendo...",
    failedSend: "⚠︎ no se pudo enviar",
    aiBadge: "AI",
    poweredByLine: "con la tecnología de",
    systemConversationClosed: "Chat cerrado",
    systemAgentJoined: "Un agente se unió al chat",
    systemAiHandoff: "La IA tomó el control del chat",
    chatDisabled: "El chat está desactivado",
    defaultTitle: "¿Cómo podemos ayudar?",
    defaultSubtitle: "Solemos responder en minutos",
    defaultPlaceholder: "Escribe tu mensaje...",
    defaultWelcome: "¡Hola! 👋 ¿En qué podemos ayudarte?",
    starterPricing: "💰 Información de precios",
    starterSupport: "🔧 Necesito soporte técnico",
    starterOrder: "📦 Rastrear mi pedido",
    talkToAgent: "🧑‍💼 Hablar con un agente",
  },
};

export function tWidget(lang: WidgetLang, key: Key): string {
  return DICT[lang]?.[key] ?? DICT.tr[key];
}

