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
  | "send"
  | "typing"
  | "failedSend"
  | "aiAgentBadge"
  | "poweredByLine";

const DICT: Record<WidgetLang, Record<Key, string>> = {
  tr: {
    loading: "Yükleniyor...",
    openChat: "Sohbeti aç",
    closeChat: "Sohbeti kapat",
    emoji: "Emoji",
    attach: "Dosya ekle",
    send: "Gönder",
    typing: "yazıyor...",
    failedSend: "⚠︎ gonderilemedi",
    aiAgentBadge: "AI Agent",
    poweredByLine: "tarafından desteklenmektedir",
  },
  en: {
    loading: "Loading...",
    openChat: "Open chat",
    closeChat: "Close chat",
    emoji: "Emoji",
    attach: "Attach file",
    send: "Send",
    typing: "typing...",
    failedSend: "⚠︎ failed to send",
    aiAgentBadge: "AI Agent",
    poweredByLine: "powered by",
  },
  es: {
    loading: "Cargando...",
    openChat: "Abrir chat",
    closeChat: "Cerrar chat",
    emoji: "Emoji",
    attach: "Adjuntar archivo",
    send: "Enviar",
    typing: "escribiendo...",
    failedSend: "⚠︎ no se pudo enviar",
    aiAgentBadge: "AI Agent",
    poweredByLine: "con la tecnologia de",
  },
};

export function tWidget(lang: WidgetLang, key: Key): string {
  return DICT[lang]?.[key] ?? DICT.tr[key];
}

