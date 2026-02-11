/**
 * Portal Self-Serve Signup Routes — Step 11.36
 *
 * POST /portal/auth/signup — create org + owner user
 * POST /portal/auth/resend-verification — resend email verification
 * GET  /portal/auth/verify-email — verify email via signed link
 */

import { FastifyInstance } from "fastify";
import crypto from "crypto";
import { prisma } from "../prisma";
import { hashPassword } from "../utils/password";
import { sendEmailAsync, getDefaultFromAddress } from "../utils/mailer";
import { getVerifyEmailContent, normalizeRequestLocale, extractLocaleCookie } from "../utils/email-templates";
import { generateVerifyEmailLink, verifyEmailSignature } from "../utils/signed-links";
import { writeAuditLog } from "../utils/audit-log";
import {
  signupEmailRateLimit,
  signupIpRateLimit,
  verifyEmailRateLimit,
  resendVerificationRateLimit,
} from "../utils/rate-limit";
import { validatePasswordPolicy } from "../utils/password-policy";
import { validateJsonContentType } from "../middleware/validation";
import { verifyHCaptchaToken } from "../utils/verify-captcha";
import { getRealIP } from "../utils/get-real-ip";

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
  // ─── POST /portal/auth/signup ─────────────────────────────
  fastify.post<{ Body: SignupBody }>(
    "/portal/auth/signup",
    {
      preHandler: [signupIpRateLimit(), signupEmailRateLimit(), validateJsonContentType],
    },
    async (request, reply) => {
      const { orgName, email, password, locale, captchaToken } = request.body;
      const cookieLang = extractLocaleCookie(request.headers.cookie as string);
      const requestedLocale = normalizeRequestLocale(locale, cookieLang, request.headers["accept-language"] as string);
      const requestId =
        (request as any).requestId ||
        (request.headers["x-request-id"] as string) ||
        undefined;

      // Validate input
      if (!orgName || !email || !password) {
        reply.code(400);
        return {
          error: {
            code: "VALIDATION_ERROR",
            message: "Organization name, email, and password are required",
            requestId,
          },
        };
      }

      const trimmedEmail = email.toLowerCase().trim();
      const trimmedOrgName = orgName.trim();
      const requestIp = getRealIP(request);

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

      const captchaValid = await verifyHCaptchaToken(captchaToken.trim(), requestIp);
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

      if (trimmedOrgName.length < 2 || trimmedOrgName.length > 100) {
        reply.code(400);
        return {
          error: {
            code: "VALIDATION_ERROR",
            message: "Organization name must be 2-100 characters",
            requestId,
          },
        };
      }

      const pwCheck = validatePasswordPolicy(password);
      if (!pwCheck.valid) {
        reply.code(400);
        return {
          error: {
            code: pwCheck.code,
            message: pwCheck.message,
            requestId,
          },
        };
      }

      // Email format check (basic)
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        reply.code(400);
        return {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid email address",
            requestId,
          },
        };
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
        console.log(`[signup] Email already verified: ${trimmedEmail} — returning generic success`);
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
        console.log(`[signup] Unverified account updated for ${trimmedEmail} — resending verification`);

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
              planStatus: "inactive",
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

      // Fire-and-forget: don't block signup response
      sendEmailAsync({
        to: targetEmail,
        from: getDefaultFromAddress(),
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        tags: ["signup", "verify-email"],
      });

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
      preHandler: [validateJsonContentType],
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
      const { email, locale } = request.body;
      const requestId =
        (request as any).requestId ||
        (request.headers["x-request-id"] as string) ||
        undefined;

      if (!email) {
        reply.code(400);
        return {
          error: {
            code: "VALIDATION_ERROR",
            message: "Email is required",
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

        // Fire-and-forget: don't block resend response
        sendEmailAsync({
          to: trimmedEmail,
          from: getDefaultFromAddress(),
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
          tags: ["resend-verification"],
        });

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
}
