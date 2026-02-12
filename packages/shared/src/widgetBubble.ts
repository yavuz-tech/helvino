export type WidgetBubbleShape = "circle" | "rounded-square";
export type WidgetBubbleIcon = "chat" | "message" | "help" | "custom";
export type WidgetBubblePosition = "bottom-right" | "bottom-left";

export interface WidgetBubbleTheme {
  primaryColor: string;
  bubbleShape: WidgetBubbleShape;
  bubbleIcon: WidgetBubbleIcon;
  bubbleSize: number;
  bubblePosition: WidgetBubblePosition;
  greetingText: string;
  greetingEnabled: boolean;
}

export interface LegacyWidgetBubbleInput {
  position?: "right" | "left";
  launcher?: "bubble" | "icon";
  launcherLabel?: string;
}

export const DEFAULT_WIDGET_BUBBLE_THEME: WidgetBubbleTheme = {
  primaryColor: "#0F5C5C",
  bubbleShape: "circle",
  bubbleIcon: "chat",
  bubbleSize: 60,
  bubblePosition: "bottom-right",
  greetingText: "",
  greetingEnabled: false,
};

function toShape(value: unknown): WidgetBubbleShape | null {
  return value === "rounded-square" || value === "circle" ? value : null;
}

function toIcon(value: unknown): WidgetBubbleIcon | null {
  return value === "chat" || value === "message" || value === "help" || value === "custom" ? value : null;
}

function toPosition(value: unknown): WidgetBubblePosition | null {
  return value === "bottom-right" || value === "bottom-left" ? value : null;
}

export function resolveWidgetBubbleTheme(
  input?: Partial<WidgetBubbleTheme> | null,
  legacy?: LegacyWidgetBubbleInput
): WidgetBubbleTheme {
  const legacyPosition: WidgetBubblePosition | null =
    legacy?.position === "left" ? "bottom-left" : legacy?.position === "right" ? "bottom-right" : null;
  const legacyShape: WidgetBubbleShape | null =
    legacy?.launcher === "icon" ? "rounded-square" : legacy?.launcher === "bubble" ? "circle" : null;
  const legacyIcon: WidgetBubbleIcon | null =
    legacy?.launcher === "icon" ? "help" : legacy?.launcher === "bubble" ? "chat" : null;
  const fallbackGreeting = (legacy?.launcherLabel || "").trim();

  const bubbleShape = toShape(input?.bubbleShape) || legacyShape || DEFAULT_WIDGET_BUBBLE_THEME.bubbleShape;
  const bubbleIcon = toIcon(input?.bubbleIcon) || legacyIcon || DEFAULT_WIDGET_BUBBLE_THEME.bubbleIcon;
  const bubblePosition = toPosition(input?.bubblePosition) || legacyPosition || DEFAULT_WIDGET_BUBBLE_THEME.bubblePosition;
  const bubbleSize = Math.max(40, Math.min(96, Number(input?.bubbleSize) || DEFAULT_WIDGET_BUBBLE_THEME.bubbleSize));

  const greetingText = String(input?.greetingText ?? fallbackGreeting ?? "").trim();
  const greetingEnabled = Boolean(input?.greetingEnabled ?? (greetingText.length > 0));

  return {
    primaryColor: String(input?.primaryColor || DEFAULT_WIDGET_BUBBLE_THEME.primaryColor),
    bubbleShape,
    bubbleIcon,
    bubbleSize,
    bubblePosition,
    greetingText,
    greetingEnabled,
  };
}

export function bubbleBorderRadius(shape: WidgetBubbleShape, size: number): string {
  if (shape === "circle") return "50%";
  const px = Math.max(12, Math.round(size * 0.28));
  return `${px}px`;
}
