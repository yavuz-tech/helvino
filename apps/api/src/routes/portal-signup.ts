/**
 * Portal Self-Serve Signup Routes — Step 11.36
 *
 * POST /portal/auth/signup — create org + owner user
 * POST /portal/auth/resend-verification — resend email verification
 * GET  /portal/auth/verify-email — verify email via signed link
 * POST /portal/auth/verification-status — poll whether email has been verified
 */

import { FastifyInstance } from "fastify";
import crypto from "crypto";
import { prisma } from "../prisma";
import {
  hashPassword,
  validatePasswordStrength,
  PASSWORD_STRENGTH_ERROR_MESSAGE,
} from "../utils/password";
import { sendEmail, getDefaultFromAddress, isMailProviderConfigured } from "../utils/mailer";
import { getVerifyEmailContent, normalizeRequestLocale, extractLocaleCookie } from "../utils/email-templates";
import { generateVerifyEmailLink, verifyEmailSignature } from "../utils/signed-links";
import { writeAuditLog } from "../utils/audit-log";
import {
  verifyEmailRateLimit,
  resendVerificationRateLimit,
} from "../utils/rate-limit";
import { rateLimit } from "../middleware/rate-limiter";
import { validateJsonContentType } from "../middleware/validation";
import { verifyTurnstileToken, isCaptchaConfigured } from "../utils/verify-captcha";
import { getRealIP } from "../utils/get-real-ip";
import { validateBody } from "../utils/validate";
import { resendVerificationSchema, signupSchema } from "../utils/schemas";
import { sanitizePlainText } from "../utils/sanitize";

function generateOrgKey(orgName: string): string {
  // Create a URL-safe slug from org name + random suffix
  const slug = orgName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 24);
  const suffix = crypto.randomBytes(3).toString("hex");
  return `${slug || "org"}-${suffix}`;
}

function generateSiteId(): string {
  return `site_${crypto.randomBytes(12).toString("hex")}`;
}

interface SignupBody {
  orgName: string;
  email: string;
  password: string;
  locale?: string;
  captchaToken?: string;
}

interface ResendBody {
  email: string;
  locale?: string;
}

const DISPOSABLE_EMAIL_DOMAINS = new Set<string>([
  "guerrillamail.com",
  "tempmail.com",
  "10minutemail.com",
  "mailinator.com",
  "yopmail.com",
  "sharklasers.com",
  "trashmail.com",
  "getnada.com",
  "temp-mail.org",
  "maildrop.cc",
  "dispostable.com",
]);

function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase() || "";
  if (!domain) return false;
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) return true;
  for (const blocked of DISPOSABLE_EMAIL_DOMAINS) {
    if (domain.endsWith(`.${blocked}`)) return true;
  }
  return false;
}

export async function portalSignupRoutes(fastify: FastifyInstance) {
  const portalSignupRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000,
    maxRequests: 30,
    message: "Too many registration attempts",
  });

  // ─── POST /portal/auth/signup ─────────────────────────────
  fastify.post<{ Body: SignupBody }>(
    "/portal/auth/signup",
    {
      preHandler: [portalSignupRateLimit, validateJsonContentType],
      config: {
        skipGlobalRateLimit: true,
      },
    },
    async (request, reply) => {
      const parsedBody = validateBody(signupSchema, request.body, reply);
      if (!parsedBody) return;

      const { orgName, email, password, locale, captchaToken } = parsedBody;
      const cookieLang = extractLocaleCookie(request.headers.cookie as string);
      const requestedLocale = normalizeRequestLocale(locale, cookieLang, request.headers["accept-language"] as string);
      const requestId =
        (request as any).requestId ||
        (request.headers["x-request-id"] as string) ||
        undefined;

      if (process.env.NODE_ENV === "production" && !isMailProviderConfigured()) {
        reply.code(503);
        return {
          error: {
            code: "EMAIL_PROVIDER_NOT_CONFIGURED",
            message: "Email service is temporarily unavailable. Please contact support.",
            requestId,
          },
        };
      }

      const trimmedEmail = email.toLowerCase().trim();
      const trimmedOrgName = sanitizePlainText(orgName).trim();
      const requestIp = getRealIP(request);

      // Captcha validation — skip if TURNSTILE_SECRET_KEY is not configured
      if (isCaptchaConfigured()) {
        if (!captchaToken?.trim()) {
          reply.code(400);
          return {
            error: {
              code: "CAPTCHA_REQUIRED",
              message: "CAPTCHA verification is required",
              requestId,
            },
          };
        }

        const captchaValid = await verifyTurnstileToken(captchaToken.trim(), requestIp);
        if (!captchaValid) {
          reply.code(400);
          return {
            error: {
              code: "INVALID_CAPTCHA",
              message: "CAPTCHA verification failed",
              requestId,
            },
          };
        }
      }

      const pwCheck = validatePasswordStrength(password);
      if (!pwCheck.valid) {
        reply.code(400);
        return { error: PASSWORD_STRENGTH_ERROR_MESSAGE };
      }

      if (isDisposableEmail(trimmedEmail)) {
        reply.code(400);
        return {
          error: {
            code: "DISPOSABLE_EMAIL_NOT_ALLOWED",
            message: "Disposable email addresses are not allowed",
            requestId,
          },
        };
      }

      // Check if email already exists
      const existing = await prisma.orgUser.findUnique({
        where: { email: trimmedEmail },
        select: { id: true, emailVerifiedAt: true, orgId: true, isActive: true },
      });

      if (existing && existing.emailVerifiedAt) {
        // Already verified — return generic success to avoid user enumeration
        return {
          ok: true,
          message: "If this email is available, a verification link has been sent.",
          requestId,
        };
      }

      let targetOrgId: string;
      let targetEmail = trimmedEmail;
      let targetLocale = requestedLocale;

      if (existing && !existing.emailVerifiedAt) {
        // ── Unverified account exists → update password & org name, resend verification ──
        const passwordHash = await hashPassword(password);

        await prisma.$transaction(async (tx) => {
          // Update user password
          await tx.orgUser.update({
            where: { id: existing.id },
            data: { passwordHash },
          });
          // Update org name
          await tx.organization.update({
            where: { id: existing.orgId },
            data: { name: trimmedOrgName, language: requestedLocale },
          });
        });

        targetOrgId = existing.orgId;
        targetLocale = requestedLocale;
        writeAuditLog(
          existing.orgId,
          "portal_signup",
          "org.unverified_re_signup",
          { ownerEmail: trimmedEmail, action: "password_updated_verification_resent" },
          requestId
        ).catch(() => {});
      } else {
        // ── New account → create org + user ──
        const passwordHash = await hashPassword(password);
        const orgKey = generateOrgKey(trimmedOrgName);
        const siteId = generateSiteId();

        const { org } = await prisma.$transaction(async (tx) => {
          const org = await tx.organization.create({
            data: {
              key: orgKey,
              siteId,
              name: trimmedOrgName,
              language: requestedLocale,
              createdVia: "self_serve",
              isActive: true,
              planKey: "free",
              planStatus: "active",
              billingStatus: "none",
            },
          });

          const orgUser = await tx.orgUser.create({
            data: {
              orgId: org.id,
              email: trimmedEmail,
              passwordHash,
              role: "owner",
              isActive: true,
              emailVerifiedAt: null,
            },
          });

          await tx.organization.update({
            where: { id: org.id },
            data: { ownerUserId: orgUser.id },
          });

          return { org, orgUser };
        });

        targetOrgId = org.id;
        targetLocale = requestedLocale;

        writeAuditLog(
          org.id,
          "portal_signup",
          "org.self_serve_created",
          { orgKey, siteId, createdVia: "self_serve", ownerEmail: trimmedEmail },
          requestId
        ).catch(() => {});
      }

      // Generate verification link (1h expiry)
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      const verifyLink = generateVerifyEmailLink(targetEmail, expiresAt);

      const emailContent = getVerifyEmailContent(targetLocale, verifyLink);

      const sendResult = await sendEmail({
        to: targetEmail,
        from: getDefaultFromAddress(),
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        tags: ["signup", "verify-email"],
      });

      if (!sendResult.success) {
        writeAuditLog(
          targetOrgId,
          "portal_signup",
          "portal.email_verification_send_failed",
          { ownerEmail: targetEmail, provider: sendResult.provider, error: sendResult.error || "unknown" },
          requestId
        ).catch(() => {});

        reply.code(503);
        return {
          error: {
            code: "EMAIL_DELIVERY_FAILED",
            message: "Verification email could not be delivered. Please try again in a few minutes.",
            requestId,
          },
        };
      }

      return {
        ok: true,
        message: "If this email is available, a verification link has been sent.",
        requestId,
      };
    }
  );

  // Alias endpoint for clients using /register naming.
  fastify.post<{ Body: SignupBody }>(
    "/portal/auth/register",
    {
      preHandler: [portalSignupRateLimit, validateJsonContentType],
      config: {
        skipGlobalRateLimit: true,
      },
    },
    async (request, reply) => {
      const baseUrl = `http://127.0.0.1:${process.env.PORT || "4000"}`;
      const proxied = await fetch(`${baseUrl}/portal/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.body),
      });
      const payload = await proxied.json().catch(() => ({ error: "Unable to process registration" }));
      reply.code(proxied.status);
      return payload;
    }
  );

  // ─── POST /portal/auth/resend-verification ────────────────
  fastify.post<{ Body: ResendBody }>(
    "/portal/auth/resend-verification",
    {
      preHandler: [resendVerificationRateLimit(), validateJsonContentType],
    },
    async (request, reply) => {
      const parsedBody = validateBody(resendVerificationSchema, request.body, reply);
      if (!parsedBody) return;
      const { email, locale } = parsedBody;
      const requestId =
        (request as any).requestId ||
        (request.headers["x-request-id"] as string) ||
        undefined;

      if (process.env.NODE_ENV === "production" && !isMailProviderConfigured()) {
        reply.code(503);
        return {
          error: {
            code: "EMAIL_PROVIDER_NOT_CONFIGURED",
            message: "Email service is temporarily unavailable. Please contact support.",
            requestId,
          },
        };
      }

      const trimmedEmail = email.toLowerCase().trim();

      // Always return generic 200 (no enumeration)
      // Only actually send if user exists + not yet verified
      const user = await prisma.orgUser.findUnique({
        where: { email: trimmedEmail },
        select: {
          id: true,
          emailVerifiedAt: true,
          orgId: true,
          isActive: true,
          organization: { select: { language: true } },
        },
      });

      if (user && !user.emailVerifiedAt && user.isActive) {
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        const verifyLink = generateVerifyEmailLink(trimmedEmail, expiresAt);

        const cookieLang = extractLocaleCookie(request.headers.cookie as string);
        const requestedLocale = normalizeRequestLocale(
          locale,
          cookieLang,
          request.headers["accept-language"] as string,
          user.organization.language || undefined
        );
        const emailContent = getVerifyEmailContent(requestedLocale, verifyLink);

        const resendResult = await sendEmail({
          to: trimmedEmail,
          from: getDefaultFromAddress(),
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
          tags: ["resend-verification"],
        });

        if (!resendResult.success) {
          writeAuditLog(
            user.orgId,
            trimmedEmail,
            "portal.email_verification_resend_failed",
            { provider: resendResult.provider, error: resendResult.error || "unknown" },
            requestId
          ).catch(() => {});
        }

        writeAuditLog(
          user.orgId,
          trimmedEmail,
          "portal.email_verification_sent",
          { resend: true },
          requestId
        ).catch(() => {});
      }

      return {
        ok: true,
        message: "If an unverified account exists, a new verification email has been sent.",
        requestId,
      };
    }
  );

  // ─── GET /portal/auth/verify-email ────────────────────────
  fastify.get<{
    Querystring: { token?: string; expires?: string; sig?: string };
  }>(
    "/portal/auth/verify-email",
    {
      preHandler: [verifyEmailRateLimit()],
    },
    async (request, reply) => {
      const { token: emailToken, expires, sig } = request.query;
      const requestId =
        (request as any).requestId ||
        (request.headers["x-request-id"] as string) ||
        undefined;

      if (!emailToken || !expires || !sig) {
        reply.code(400);
        return {
          error: {
            code: "INVALID_LINK",
            message: "Missing or invalid verification parameters",
            requestId,
          },
        };
      }

      // Verify signature + expiry
      const result = verifyEmailSignature(emailToken, expires, sig);

      if (!result.valid) {
        reply.code(400);
        return {
          error: {
            code: result.expired ? "LINK_EXPIRED" : "INVALID_LINK",
            message: result.error || "Invalid verification link",
            requestId,
          },
        };
      }

      // Find user by email (the token IS the email)
      const email = emailToken.toLowerCase().trim();
      const user = await prisma.orgUser.findUnique({
        where: { email },
        select: { id: true, emailVerifiedAt: true, orgId: true },
      });

      if (!user) {
        // Generic response to avoid enumeration
        return { ok: true, message: "Email verified successfully.", requestId };
      }

      // Idempotent: if already verified, just return success
      if (!user.emailVerifiedAt) {
        await prisma.orgUser.update({
          where: { id: user.id },
          data: { emailVerifiedAt: new Date() },
        });

        writeAuditLog(
          user.orgId,
          email,
          "portal.email_verified",
          {},
          requestId
        ).catch(() => {});
      }

      return { ok: true, message: "Email verified successfully.", requestId };
    }
  );

  // ─── POST /portal/auth/verification-status ─────────────────
  // Lightweight polling endpoint: the signup page calls this every few
  // seconds so it can auto-redirect once the user verifies from another
  // device / tab.  Only returns { verified: boolean }.
  const verificationStatusRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute window
    maxRequests: 30, // generous — polling every 3-4 s
    message: "Too many verification status checks",
  });

  fastify.post<{ Body: { email: string } }>(
    "/portal/auth/verification-status",
    {
      preHandler: [verificationStatusRateLimit, validateJsonContentType],
    },
    async (request, reply) => {
      const { email: rawEmail } = request.body || {};
      if (!rawEmail || typeof rawEmail !== "string") {
        reply.code(400);
        return { error: "Missing email" };
      }

      const email = rawEmail.trim().toLowerCase();

      // Always return the same shape to avoid email enumeration.
      const NOT_VERIFIED = { verified: false } as const;

      try {
        const user = await prisma.orgUser.findUnique({
          where: { email },
          select: { emailVerifiedAt: true },
        });

        if (!user) return NOT_VERIFIED; // don't reveal existence
        return { verified: !!user.emailVerifiedAt };
      } catch {
        // Swallow DB errors — treat as "not verified" to avoid leaking info
        return NOT_VERIFIED;
      }
    }
  );
}
