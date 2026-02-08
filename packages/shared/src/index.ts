/**
 * @helvino/shared
 * Shared utilities and types across Helvino monorepo
 */

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

export interface Bot {
  id: string;
  name: string;
  color: string;
  subtitle: string;
  isActive: boolean;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export const APP_NAME = "Helvino";
export const APP_DOMAIN = "helvino.io";

export { EMOJI_LIST } from "./emojis";

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
