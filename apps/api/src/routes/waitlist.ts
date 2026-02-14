import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { createRateLimitMiddleware } from "../middleware/rate-limit";
import { validateJsonContentType } from "../middleware/validation";
import { sendEmailAsync, getDefaultFromAddress } from "../utils/mailer";

type WaitlistType = "early_access" | "founding_member";

function isValidEmail(email: string): boolean {
  if (email.length < 3 || email.length > 254) return false;
  // Conservative email validation: good enough for waitlist.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderAdminNotificationHtml(input: {
  email: string;
  type: WaitlistType;
  createdAtIso: string;
  total: number;
}): string {
  const safeEmail = escapeHtml(input.email);
  const safeType = escapeHtml(input.type);
  const safeCreatedAt = escapeHtml(input.createdAtIso);
  const safeTotal = escapeHtml(String(input.total));

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0b0b0b;color:#ffffff;">
  <div style="max-width:640px;margin:0 auto;border:1px solid rgba(245,158,11,0.25);border-radius:14px;overflow:hidden;">
    <div style="padding:16px 18px;background:rgba(245,158,11,0.12);border-bottom:1px solid rgba(245,158,11,0.2);">
      <div style="font-weight:800;letter-spacing:-0.2px;">Helvion — Waitlist</div>
    </div>
    <div style="padding:18px;">
      <p style="margin:0 0 12px;font-size:14px;opacity:0.9;">Yeni waitlist kaydi alindi:</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;border-collapse:collapse;">
        <tr><td style="padding:8px 0;opacity:0.75;">Email</td><td style="padding:8px 0;font-weight:700;">${safeEmail}</td></tr>
        <tr><td style="padding:8px 0;opacity:0.75;">Type</td><td style="padding:8px 0;font-weight:700;">${safeType}</td></tr>
        <tr><td style="padding:8px 0;opacity:0.75;">Created</td><td style="padding:8px 0;">${safeCreatedAt}</td></tr>
        <tr><td style="padding:8px 0;opacity:0.75;">Total waitlist</td><td style="padding:8px 0;font-weight:700;color:#F59E0B;">${safeTotal}</td></tr>
      </table>
    </div>
  </div>
</body>
</html>`;
}

function renderUserWelcomeHtml(input: { type: WaitlistType }): { subject: string; html: string; text: string } {
  const isFounding = input.type === "founding_member";
  const subject = isFounding
    ? "Helvion Kurucu Uyesi Oldunuz! 🏆"
    : "Helvion'a Hos Geldiniz! 🎉 Erken Erisim Yeriniz Ayrildi";

  const body = isFounding
    ? "Tebrikler! Helvion'un kurucu uyelerinden biri oldunuz. %40 omur boyu indirim hakkiniz ve oncelikli erisim ayricaliginiz guvence altinda. Lansman gununde sizi ozel olarak bilgilendirecegiz."
    : "Helvion'un erken erisim listesine kaydiniz tamamlandi. Lansman gununde ilk siz haberdar olacaksiniz. AI destekli musteri destek platformumuz cok yakinda sizlerle!";

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#050505;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:44px 0;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;">
        <tr><td style="padding:0 18px 14px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:44px;height:44px;border-radius:14px;background:linear-gradient(135deg,#F59E0B,#B45309);display:flex;align-items:center;justify-content:center;box-shadow:0 8px 30px rgba(245,158,11,0.18);">
              <span style="font-weight:900;font-size:20px;line-height:1;color:#050505;">H</span>
            </div>
            <div style="font-size:18px;font-weight:800;letter-spacing:-0.2px;">Helvion</div>
          </div>
        </td></tr>
        <tr><td style="padding:0 18px;">
          <div style="border:1px solid rgba(255,255,255,0.08);border-radius:18px;background:rgba(255,255,255,0.03);padding:26px;box-shadow:0 10px 40px rgba(0,0,0,0.35);">
            <div style="display:inline-block;padding:6px 10px;border-radius:999px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.28);color:#F59E0B;font-size:11px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;">
              ${isFounding ? "Founding Member" : "Early Access"}
            </div>
            <h1 style="margin:14px 0 10px;font-size:24px;line-height:1.25;letter-spacing:-0.4px;">
              Merhaba,
            </h1>
            <p style="margin:0 0 14px;font-size:14.5px;line-height:1.75;color:rgba(255,255,255,0.82);">
              ${escapeHtml(body)}
            </p>
            <p style="margin:18px 0 0;font-size:13px;line-height:1.7;color:rgba(255,255,255,0.7);">
              Sorulariniz icin <a href="mailto:hello@helvion.io" style="color:#F59E0B;text-decoration:none;font-weight:700;">hello@helvion.io</a>
            </p>
          </div>
        </td></tr>
        <tr><td style="padding:16px 18px 0;text-align:center;">
          <div style="font-size:12px;color:rgba(255,255,255,0.45);">
            © 2026 Helvion · Vertex Digital Systems LLC
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `Merhaba,\n\n${body}\n\nSorulariniz icin hello@helvion.io\n\n© 2026 Helvion · Vertex Digital Systems LLC`;
  return { subject, html, text };
}

export async function waitlistRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/waitlist",
    {
      preHandler: [
        validateJsonContentType,
        createRateLimitMiddleware({
          limit: 5,
          windowMs: 60 * 60 * 1000,
          routeName: "public.waitlist",
        }),
      ],
    },
    async (request, reply) => {
      const body = (request.body || {}) as { email?: unknown; type?: unknown };

      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const type = body.type as WaitlistType;

      if (!email || !isValidEmail(email)) {
        reply.code(400);
        return { error: { code: "INVALID_EMAIL", message: "Invalid email address" } };
      }
      if (type !== "early_access" && type !== "founding_member") {
        reply.code(400);
        return { error: { code: "INVALID_TYPE", message: "Invalid waitlist type" } };
      }

      const existing = await prisma.waitlist.findUnique({
        where: { email },
        select: { id: true },
      });
      if (existing) {
        // Duplicate: 200 OK, do not send emails.
        return { ok: true, duplicate: true };
      }

      const created = await prisma.waitlist.create({
        data: { email, type },
        select: { createdAt: true },
      });

      const total = await prisma.waitlist.count().catch(() => 0);
      const createdAtIso = created.createdAt.toISOString();

      // Mail 1 — admin notification
      sendEmailAsync({
        to: "support@helvion.io",
        from: getDefaultFromAddress(),
        subject: `🔔 Yeni Waitlist Kaydı: ${email}`,
        html: renderAdminNotificationHtml({ email, type, createdAtIso, total }),
        text: `New waitlist signup\nEmail: ${email}\nType: ${type}\nCreated: ${createdAtIso}\nTotal: ${total}`,
        tags: ["waitlist", "admin-notify"],
      });

      // Mail 2 — user welcome
      const welcome = renderUserWelcomeHtml({ type });
      sendEmailAsync({
        to: email,
        from: getDefaultFromAddress(),
        replyTo: "hello@helvion.io",
        subject: welcome.subject,
        html: welcome.html,
        text: welcome.text,
        tags: ["waitlist", type],
      });

      return { ok: true, duplicate: false };
    }
  );
}

