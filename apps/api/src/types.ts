/**
 * Core types for Helvion API
 */

export interface Organization {
  id: string;
  key: string; // Unique tenant identifier (internal)
  siteId?: string; // Public site identifier for widget embedding
  name: string;
  allowedDomains?: string[]; // Domain allowlist for CORS and widget embeds
  allowLocalhost?: boolean; // Allow localhost/127.0.0.1 for development
  widgetEnabled?: boolean; // Kill switch for entire widget
  writeEnabled?: boolean; // Kill switch for write operations
  aiEnabled?: boolean; // Kill switch for AI features
  primaryColor?: string; // Custom theme color
  widgetName?: string; // Widget branding: bot name
  widgetSubtitle?: string; // Widget branding: subtitle
  language?: string; // Widget language code (en, tr, de, fr, es)
  launcherText?: string | null; // Optional launcher button text
  position?: string; // Widget position: "right" or "left"
  messageRetentionDays?: number; // Data retention policy (days)
  hardDeleteOnRetention?: boolean; // Hard delete vs soft delete (redact)
  lastRetentionRunAt?: Date | string | null; // Last retention job run
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
  billingStatus?: string;
  currentPeriodEnd?: Date | string | null;
  cancelAtPeriodEnd?: boolean;
  billingEnforced?: boolean;
  billingGraceDays?: number;
  lastStripeEventAt?: Date | string | null;
  lastStripeEventId?: string | null;
  graceEndsAt?: Date | string | null;
  billingLockedAt?: Date | string | null;
  lastPaymentFailureAt?: Date | string | null;
  lastBillingReconcileAt?: Date | string | null;
  lastBillingReconcileResult?: unknown;
  trialEndsAt?: Date | string | null;
  planKey?: string;
  planStatus?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  // AI tracking fields
  isAIGenerated?: boolean;
  aiProvider?: string | null;
  aiModel?: string | null;
  aiTokensUsed?: number | null;
  aiCost?: number | null;
  aiResponseTime?: number | null;
}

export interface AiMessageMeta {
  provider: string;
  model: string;
  tokensUsed: number;
  cost: number;
  responseTimeMs: number;
}

export interface Conversation {
  id: string;
  orgId: string; // Tenant isolation
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface ConversationDetail extends Conversation {
  messages: Message[];
}

export interface CreateConversationRequest {
  // No body needed for now
}

export interface CreateConversationResponse {
  id: string;
  createdAt: string;
  m3Limited?: boolean;
}

export interface CreateMessageRequest {
  role: "user" | "assistant";
  content: string;
}

export interface CreateMessageResponse {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}
