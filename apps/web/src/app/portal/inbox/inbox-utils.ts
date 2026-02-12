import { sanitizeHTML } from "@/utils/sanitize";

const AVATAR_GRADIENTS = [
  "from-teal-500 to-emerald-600",
  "from-blue-500 to-indigo-600",
  "from-violet-500 to-purple-600",
  "from-rose-500 to-pink-600",
  "from-amber-500 to-orange-600",
  "from-cyan-500 to-blue-600",
  "from-fuchsia-500 to-pink-600",
  "from-emerald-500 to-teal-600",
  "from-indigo-500 to-violet-600",
  "from-sky-500 to-cyan-600",
];

export function getInitials(str: string): string {
  const parts = str.split(/[@.\s]+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return str.substring(0, 2).toUpperCase();
}

export function getAvatarColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return `bg-gradient-to-br ${AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length]}`;
}

export function formatTime(dateStr: string, hydrated: boolean): string {
  if (!hydrated) return dateStr.replace("T", " ").slice(11, 16);
  try {
    return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return dateStr.slice(11, 16);
  }
}

export function formatDateTime(dateStr: string, hydrated: boolean): string {
  if (!hydrated) return dateStr.replace("T", " ").slice(0, 16);
  try {
    const d = new Date(dateStr);
    const mo = d.toLocaleString("en", { month: "short" });
    return `${mo} ${d.getDate()}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return dateStr.slice(0, 16);
  }
}

export function formatRelativeTime(dateStr: string, t: (key: string) => string): string {
  try {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = Math.max(0, now - then);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t("common.time.now");
    if (mins < 60) return `${mins}${t("common.time.minuteShort")}`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}${t("common.time.hourShort")}`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}${t("common.time.dayShort")}`;
    const weeks = Math.floor(days / 7);
    return `${weeks}${t("common.time.weekShort")}`;
  } catch {
    return "";
  }
}

export function sanitizeConversationMessage<T extends { content: string }>(message: T): T {
  return {
    ...message,
    content: sanitizeHTML(message.content || ""),
  };
}
