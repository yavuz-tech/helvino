/**
 * Transactional Email System — Step 11.27
 *
 * Provider-agnostic email abstraction:
 * - DEV mode: "console" provider — logs payload safely (no secrets)
 * - PRODUCTION: configurable via MAIL_PROVIDER env var
 *   Supported: "console" (default), "smtp" (ready for nodemailer integration)
 *
 * Never logs email body content in production. Never leaks secrets.
 */

// ── Types ──

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string; // plain text fallback
  from?: string; // override default sender
  replyTo?: string;
  tags?: string[]; // for tracking/categorization
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  provider: string;
  error?: string;
}

export interface EmailProvider {
  name: string;
  send(payload: EmailPayload): Promise<EmailResult>;
}

// ── Helpers ──

export function isMailProviderConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY ||
    process.env.POSTMARK_SERVER_TOKEN ||
    process.env.SMTP_HOST
  );
}

function getDefaultFrom(): string {
  return process.env.MAIL_FROM || process.env.EMAIL_FROM || "noreply@helvion.io";
}

/** Extract first href from HTML (e.g. invite/reset link) for dev logging */
function extractFirstLink(html: string): string | null {
  const match = html.match(/href=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

// ── Console Provider (DEV) ──

class ConsoleEmailProvider implements EmailProvider {
  name = "console";

  async send(payload: EmailPayload): Promise<EmailResult> {
    const messageId = `console-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    console.info("╔══════════════════════════════════════════════════╗");
    console.info("║  📧 EMAIL (console provider — dev mode)          ║");
    console.info("╚══════════════════════════════════════════════════╝");
    console.info(`  To:      ${payload.to}`);
    console.info(`  From:    ${payload.from || getDefaultFrom()}`);
    console.info(`  Subject: ${payload.subject}`);
    if (payload.tags?.length) {
      console.info(`  Tags:    ${payload.tags.join(", ")}`);
    }
    console.info(`  ID:      ${messageId}`);
    const link = extractFirstLink(payload.html);
    if (link && payload.tags?.includes("invite")) {
      console.info(`  📎 Invite link (dev): ${link}`);
    } else if (link && (payload.tags?.includes("reset") || payload.tags?.includes("password-reset") || payload.tags?.includes("verify-email") || payload.tags?.includes("recovery"))) {
      console.info(`  📎 Link (dev): ${link}`);
    }
    console.info("──────────────────────────────────────────────────");
    const preview = payload.text || payload.html.replace(/<[^>]*>/g, "").substring(0, 500);
    console.info(`  Body:    ${preview}`);
    console.info("══════════════════════════════════════════════════");

    return { success: true, messageId, provider: this.name };
  }
}

// ── SMTP Provider (nodemailer) ──

class SmtpEmailProvider implements EmailProvider {
  name = "smtp";

  async send(payload: EmailPayload): Promise<EmailResult> {
    const host = process.env.SMTP_HOST;
    if (!host) {
      console.warn("[mailer] SMTP_HOST not configured; falling back to console output");
      return new ConsoleEmailProvider().send(payload);
    }

    try {
      const nodemailer = require("nodemailer");
      const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
      const secure = process.env.SMTP_SECURE === "true" || process.env.SMTP_SECURE === "1";
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth:
          process.env.SMTP_USER && process.env.SMTP_PASS
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            : undefined,
      });
      const from = payload.from || getDefaultFrom();
      const info = await transporter.sendMail({
        from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        replyTo: payload.replyTo,
      });
      return {
        success: true,
        messageId: info.messageId ?? `smtp-${Date.now()}`,
        provider: this.name,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown SMTP error";
      console.error(`[mailer:smtp] Send failed: ${errorMessage}`);
      return {
        success: false,
        provider: this.name,
        error: errorMessage,
      };
    }
  }
}

// ── Public API ──

/**
 * Build an ordered list of available providers (primary + fallbacks).
 * Console is only used when NO real provider is configured — otherwise we would
 * "succeed" via console log and the user would think email was sent when it wasn't.
 *
 * The chain is cached as a singleton after first call (providers don't change at runtime).
 */
let _cachedProviders: EmailProvider[] | null = null;

function getProviderChain(): EmailProvider[] {
  if (_cachedProviders) return _cachedProviders;

  const providers: EmailProvider[] = [];

  // Postmark
  if (process.env.POSTMARK_SERVER_TOKEN) {
    const { PostmarkEmailProvider } = require("../email/providers/postmark");
    const messageStream = process.env.POSTMARK_MESSAGE_STREAM || "outbound";
    providers.push(new PostmarkEmailProvider(process.env.POSTMARK_SERVER_TOKEN, messageStream));
  }

  // Resend
  if (process.env.RESEND_API_KEY) {
    const { ResendEmailProvider } = require("../email/providers/resend");
    providers.push(new ResendEmailProvider(process.env.RESEND_API_KEY));
  }

  // SMTP
  if (process.env.SMTP_HOST) {
    providers.push(new SmtpEmailProvider());
  }

  // Console only when no real provider in non-production.
  // In production, fail closed so delivery issues are visible instead of silently "succeeding".
  if (providers.length === 0) {
    if (process.env.NODE_ENV === "production") {
      console.error("[mailer] No email provider configured in production (RESEND_API_KEY, POSTMARK_SERVER_TOKEN, or SMTP_HOST). Email delivery disabled.");
    } else {
      console.warn("[mailer] No email provider configured (RESEND_API_KEY, POSTMARK_SERVER_TOKEN, or SMTP_HOST). Emails will only be logged.");
      providers.push(new ConsoleEmailProvider());
    }
  }

  _cachedProviders = providers;
  console.info(`[mailer] Provider chain initialized: ${providers.map((p) => p.name).join(" → ")}`);
  return providers;
}

/**
 * Send a transactional email via the configured provider.
 * Automatically falls back to the next provider if the primary fails.
 * Safe to call in dev (console output) and production (actual delivery).
 */
export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  let providers: EmailProvider[];

  try {
    providers = getProviderChain();
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown provider error";
    console.error(`[mailer] Failed to initialize email providers: ${errorMessage}`);
    return {
      success: false,
      provider: "unknown",
      error: `Provider init failed: ${errorMessage}`,
    };
  }

  // Set default from
  if (!payload.from) {
    payload.from = getDefaultFrom();
  }

  for (const provider of providers) {
    const t0 = Date.now();
    console.info(`[mailer] Sending email via ${provider.name} to=${payload.to} subject="${payload.subject}"`);

    try {
      const result = await provider.send(payload);
      const elapsed = Date.now() - t0;

      if (result.success) {
        console.info(`[mailer] Email sent via ${provider.name} in ${elapsed}ms messageId=${result.messageId}`);
        return result;
      }

      // Provider returned failure — log and try next
      console.warn(`[mailer] Send failed via ${provider.name} in ${elapsed}ms: ${result.error} — trying next provider…`);
    } catch (err) {
      const elapsed = Date.now() - t0;
      const errorMessage = err instanceof Error ? err.message : "Unknown email error";
      console.warn(`[mailer] Exception in ${provider.name} after ${elapsed}ms: ${errorMessage} — trying next provider…`);
    }
  }

  // All providers exhausted
  console.error(`[mailer] All providers exhausted; email NOT delivered to=${payload.to}`);
  return {
    success: false,
    provider: "all-failed",
    error: "All email providers failed. Check configuration and limits.",
  };
}

/**
 * Send email without blocking — fire-and-forget with error logging.
 * Use for emails where the API response doesn't depend on delivery success
 * (e.g. password reset, verification resend, recovery notifications).
 */
export function sendEmailAsync(payload: EmailPayload): void {
  sendEmail(payload).catch((err) => {
    console.error(`[mailer:async] Fire-and-forget email failed to=${payload.to}:`, err instanceof Error ? err.message : err);
  });
}

/**
 * Get the currently configured mail provider name(s) (for diagnostics).
 */
export function getMailProviderName(): string {
  try {
    return getProviderChain().map((p) => p.name).join(" → ");
  } catch {
    return "unknown";
  }
}

/**
 * Get default From address from env (for explicit use in routes).
 */
export function getDefaultFromAddress(): string {
  return getDefaultFrom();
}
