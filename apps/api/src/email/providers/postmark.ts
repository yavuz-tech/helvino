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
      From: payload.from || process.env.EMAIL_FROM || "noreply@helvion.io",
      To: payload.to,
      Subject: payload.subject,
      HtmlBody: payload.html,
      TextBody: payload.text || "",
      MessageStream: this.messageStream,
      TrackOpens: false, // Disable open tracking — tracking pixel triggers spam filters
      TrackLinks: "None", // Disable link tracking — redirect URLs trigger Gmail spam
      ...(payload.replyTo && { ReplyTo: payload.replyTo }),
      ...(payload.tags?.length && { Tag: payload.tags[0] }), // Postmark supports 1 tag per message
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

      const data = (await response.json()) as Record<string, unknown>;

      if (!response.ok) {
        const errorMessage = (data.Message as string) || `HTTP ${response.status}`;
        console.error(`[mailer:postmark] Send failed: ${errorMessage}`);
        return {
          success: false,
          provider: this.name,
          error: errorMessage,
        };
      }

      const messageId = data.MessageID as string | undefined;

      // Postmark may return 200/OK but silently drop the email when the
      // monthly free-tier limit (100 emails) is exhausted. Verify by
      // fetching the message details — if it doesn't exist, treat as failure.
      if (messageId) {
        try {
          const verify = await fetch(
            `https://api.postmarkapp.com/messages/outbound/${messageId}/details`,
            {
              headers: {
                Accept: "application/json",
                "X-Postmark-Server-Token": this.serverToken,
              },
            }
          );
          if (verify.status === 404 || verify.status === 422) {
            const vData = (await verify.json().catch(() => ({}))) as Record<string, unknown>;
            if ((vData.ErrorCode as number) === 701) {
              console.error(
                `[mailer:postmark] Email accepted (200 OK) but NOT found in outbound (ErrorCode 701). Monthly limit likely exceeded.`
              );
              return {
                success: false,
                provider: this.name,
                error: "Postmark monthly email limit exceeded — email silently dropped. Upgrade plan or switch provider.",
              };
            }
          }
        } catch {
          // Verification fetch failed — don't block, treat original response as truth
        }
      }

      return {
        success: true,
        messageId,
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
