/**
 * Postmark Email Provider — Step 11.50
 *
 * Activates when POSTMARK_SERVER_TOKEN is present.
 * Uses native fetch (no dependencies).
 */

import type { EmailProvider, EmailPayload, EmailResult } from "../../utils/mailer";

export class PostmarkEmailProvider implements EmailProvider {
  name = "postmark";
  private serverToken: string;
  private messageStream: string;

  constructor(serverToken: string, messageStream = "outbound") {
    this.serverToken = serverToken;
    this.messageStream = messageStream;
  }

  async send(payload: EmailPayload): Promise<EmailResult> {
    const postmarkPayload = {
      From: payload.from || process.env.EMAIL_FROM || "noreply@helvino.com",
      To: payload.to,
      Subject: payload.subject,
      HtmlBody: payload.html,
      TextBody: payload.text || "",
      MessageStream: this.messageStream,
      TrackOpens: false, // Disable open tracking — tracking pixel triggers spam filters
      TrackLinks: "None", // Disable link tracking — redirect URLs trigger Gmail spam
      ...(payload.replyTo && { ReplyTo: payload.replyTo }),
    };

    try {
      const response = await fetch("https://api.postmarkapp.com/email", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "X-Postmark-Server-Token": this.serverToken,
        },
        body: JSON.stringify(postmarkPayload),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = (data as any).Message || `HTTP ${response.status}`;
        console.error(`[mailer:postmark] Send failed: ${errorMessage}`);
        return {
          success: false,
          provider: this.name,
          error: errorMessage,
        };
      }

      return {
        success: true,
        messageId: (data as any).MessageID,
        provider: this.name,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error(`[mailer:postmark] Exception: ${errorMessage}`);
      return {
        success: false,
        provider: this.name,
        error: errorMessage,
      };
    }
  }
}
