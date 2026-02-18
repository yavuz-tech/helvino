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

export const APP_NAME = "Helvion";
export const APP_DOMAIN = "helvion.io";

export { EMOJI_LIST } from "./emojis";
export {
  DEFAULT_WIDGET_BUBBLE_THEME,
  bubbleBorderRadius,
  resolveWidgetBubbleTheme,
} from "./widgetBubble";
export {
  ALL_FEATURE_KEYS,
  FEATURE_MIN_PLAN,
  PLAN_AI_LIMITS,
  PLAN_MAX_AGENTS,
  PLAN_M3_LIMITS,
  getAiLimitForPlan,
  isBrandingRequired,
  isPlanAllowedForFeature,
  normalizePlanKey,
  planTier,
} from "./plan";
export type { FeatureKey, PlanKey } from "./plan";
export type {
  WidgetBubbleTheme,
  WidgetBubbleShape,
  WidgetBubbleIcon,
  WidgetBubblePosition,
  LegacyWidgetBubbleInput,
} from "./widgetBubble";

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
