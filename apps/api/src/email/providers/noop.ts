/**
 * NOOP Email Provider — Step 11.50
 *
 * Safe default when no email provider is configured.
 * Logs a clear message and returns success (no crash).
 */

import type { EmailProvider, EmailPayload, EmailResult } from "../../utils/mailer";

export class NoopEmailProvider implements EmailProvider {
  name = "noop";

  async send(payload: EmailPayload): Promise<EmailResult> {
    const messageId = `noop-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    console.log("[mailer:noop] EMAIL_DISABLED — no provider configured");
    console.log(`  To:      ${payload.to}`);
    console.log(`  Subject: ${payload.subject}`);
    console.log(`  ID:      ${messageId}`);
    const linkMatch = payload.html?.match(/href=["']([^"']+)["']/i);
    if (linkMatch && payload.tags?.length) {
      console.log(`  📎 Link (copy for dev): ${linkMatch[1]}`);
    }

    return {
      success: true,
      messageId,
      provider: this.name,
    };
  }
}
