/**
 * Resend Email Provider
 *
 * Activates when RESEND_API_KEY is present.
 * Uses native fetch (no dependencies).
 * https://resend.com/docs/api-reference/emails/send-email
 *
 * Timeout: 5 seconds — if Resend doesn't respond, we abort and fail fast.
 */

import type { EmailProvider, EmailPayload, EmailResult } from "../../utils/mailer";

const RESEND_TIMEOUT_MS = 5_000;

export class ResendEmailProvider implements EmailProvider {
  name = "resend";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async send(payload: EmailPayload): Promise<EmailResult> {
    let from = payload.from || process.env.EMAIL_FROM || process.env.MAIL_FROM || "noreply@helvion.io";
    // Optional dev fallback: force resend.dev sender only when explicitly enabled.
    // This should stay OFF in production, otherwise Resend may keep account in testing behavior.
    const forceResendDevFrom =
      process.env.FORCE_RESEND_DEV_FROM === "true" || process.env.FORCE_RESEND_DEV_FROM === "1";
    if (forceResendDevFrom) {
      from = "Helvion <onboarding@resend.dev>";
    }
    const resendPayload = {
      from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      ...(payload.text && { text: payload.text }),
      ...(payload.replyTo && { reply_to: payload.replyTo }),
    };

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), RESEND_TIMEOUT_MS);

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(resendPayload),
        signal: controller.signal,
      });

      clearTimeout(timer);

      const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

      if (!response.ok) {
        const errorMessage = (data.message as string) || `HTTP ${response.status}`;
        console.error(`[mailer:resend] Send failed: ${errorMessage}`);
        console.error("[mailer:resend] Full response:", JSON.stringify(data));
        return {
          success: false,
          provider: this.name,
          error: errorMessage,
        };
      }

      const messageId = (data as { id?: string }).id;
      return {
        success: true,
        messageId: messageId ?? undefined,
        provider: this.name,
      };
    } catch (err) {
      const errorMessage = err instanceof Error
        ? (err.name === "AbortError" ? `Timeout after ${RESEND_TIMEOUT_MS}ms` : err.message)
        : "Unknown error";
      console.error(`[mailer:resend] Exception: ${errorMessage}`);
      return {
        success: false,
        provider: this.name,
        error: errorMessage,
      };
    }
  }
}
