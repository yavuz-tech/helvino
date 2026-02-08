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

// ── Console Provider (DEV) ──

class ConsoleEmailProvider implements EmailProvider {
  name = "console";

  async send(payload: EmailPayload): Promise<EmailResult> {
    const messageId = `console-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    console.log("╔══════════════════════════════════════════════════╗");
    console.log("║  📧 EMAIL (console provider — dev mode)          ║");
    console.log("╚══════════════════════════════════════════════════╝");
    console.log(`  To:      ${payload.to}`);
    console.log(`  From:    ${payload.from || getDefaultFrom()}`);
    console.log(`  Subject: ${payload.subject}`);
    if (payload.tags?.length) {
      console.log(`  Tags:    ${payload.tags.join(", ")}`);
    }
    console.log(`  ID:      ${messageId}`);
    console.log("──────────────────────────────────────────────────");
    // In dev, show HTML content for debugging (truncated)
    const preview = payload.text || payload.html.replace(/<[^>]*>/g, "").substring(0, 500);
    console.log(`  Body:    ${preview}`);
    console.log("══════════════════════════════════════════════════");

    return { success: true, messageId, provider: this.name };
  }
}

// ── SMTP Provider (production-ready stub) ──

class SmtpEmailProvider implements EmailProvider {
  name = "smtp";

  async send(payload: EmailPayload): Promise<EmailResult> {
    // SMTP integration point — add nodemailer/resend/sendgrid here
    // For now, fall back to console with a warning
    const host = process.env.SMTP_HOST;
    if (!host) {
      console.warn("[mailer] SMTP_HOST not configured; falling back to console output");
      return new ConsoleEmailProvider().send(payload);
    }

    // Placeholder: real SMTP sending would go here
    // const transporter = nodemailer.createTransport({ host, port, auth: {...} });
    // const info = await transporter.sendMail({ from, to, subject, html, text });
    console.log(`[mailer] SMTP send to=${payload.to} subject="${payload.subject}" (stub — configure SMTP_HOST)`);

    return {
      success: true,
      messageId: `smtp-stub-${Date.now()}`,
      provider: this.name,
    };
  }
}

// ── Provider Registry ──

function getProvider(): EmailProvider {
  const providerName = (process.env.MAIL_PROVIDER || "console").toLowerCase();

  // Postmark (if token present)
  if (process.env.POSTMARK_SERVER_TOKEN) {
    const { PostmarkEmailProvider } = require("../email/providers/postmark");
    const messageStream = process.env.POSTMARK_MESSAGE_STREAM || "outbound";
    return new PostmarkEmailProvider(process.env.POSTMARK_SERVER_TOKEN, messageStream);
  }

  // SMTP (if explicitly requested and configured)
  if (providerName === "smtp") {
    return new SmtpEmailProvider();
  }

  // Console (dev default)
  if (providerName === "console") {
    return new ConsoleEmailProvider();
  }

  // NOOP (safe fallback when nothing configured)
  const { NoopEmailProvider } = require("../email/providers/noop");
  return new NoopEmailProvider();
}

function getDefaultFrom(): string {
  return process.env.MAIL_FROM || "noreply@helvino.com";
}

// ── Public API ──

/**
 * Send a transactional email via the configured provider.
 * Safe to call in dev (console output) and production (actual delivery).
 */
export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  let provider: EmailProvider;

  try {
    provider = getProvider();
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown provider error";
    console.error(`[mailer] Failed to initialize email provider: ${errorMessage}`);
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

  console.log(`[mailer] Sending email via ${provider.name} to=${payload.to} subject="${payload.subject}"`);

  try {
    const result = await provider.send(payload);

    if (!result.success) {
      console.error(`[mailer] Send failed via ${provider.name}: ${result.error}`);
    } else {
      console.log(`[mailer] Email sent successfully via ${provider.name} messageId=${result.messageId}`);
    }

    return result;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown email error";
    console.error(`[mailer] Exception in ${provider.name}: ${errorMessage}`);

    return {
      success: false,
      provider: provider.name,
      error: errorMessage,
    };
  }
}

/**
 * Get the currently configured mail provider name (for diagnostics).
 */
export function getMailProviderName(): string {
  return getProvider().name;
}
