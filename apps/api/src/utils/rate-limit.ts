/**
 * Rate Limit Utility — Step 11.29
 *
 * Provides higher-level rate limit configuration presets
 * for common endpoint patterns. Uses the middleware factory
 * from middleware/rate-limit.ts under the hood.
 *
 * Key strategies:
 *   "ip"          – per client IP (auth endpoints)
 *   "ip+user"     – per IP + user/email combo (MFA, challenge)
 *   "ip+org"      – per IP + org (team actions)
 *   "user"        – per user only (recovery, emergency)
 *
 * Config:
 *   RATE_LIMIT_DEV_MULTIPLIER  – multiplier for dev (default 3)
 */

import { FastifyRequest } from "fastify";
import { createRateLimitMiddleware, RateLimitConfig } from "../middleware/rate-limit";
import { getRealIP } from "./get-real-ip";

// ── Key builders ──

/** Per-IP key */
function ipKey(request: FastifyRequest): string {
  return `ip:${getRealIP(request)}`;
}

/** Per-IP + email key (for login/forgot-password) */
function ipEmailKey(request: FastifyRequest): string {
  const body = request.body as Record<string, unknown> | null;
  const email = body?.email ? String(body.email).toLowerCase().substring(0, 128) : "anon";
  return `ip_email:${getRealIP(request)}:${email}`;
}

/** Per-email only key (for resend verification — rate limit per customer) */
function emailOnlyKey(request: FastifyRequest): string {
  const body = request.body as Record<string, unknown> | null;
  const email = body?.email ? String(body.email).toLowerCase().substring(0, 128) : "anon";
  return `email:${email}`;
}

/** Per-IP + userId key (for MFA/session endpoints where user is known) */
function ipUserKey(request: FastifyRequest): string {
  const portalUser = (request as any).portalUser;
  const userId = portalUser?.id
    || request.session?.adminUserId
    || request.session?.orgUserId
    || "anon";
  return `ip_user:${getRealIP(request)}:${userId}`;
}

/** Per-org key (for team/invite endpoints) */
function orgKey(request: FastifyRequest): string {
  const portalUser = (request as any).portalUser;
  const orgId = portalUser?.orgId || request.session?.orgId || "anon";
  return `org:${orgId}`;
}

/** Per-user key (for recovery/emergency) */
function userKey(request: FastifyRequest): string {
  const body = request.body as Record<string, unknown> | null;
  const email = body?.email ? String(body.email).toLowerCase().substring(0, 128) : "";
  const portalUser = (request as any).portalUser;
  const userId = portalUser?.id || request.session?.adminUserId || email || "anon";
  return `user:${userId}`;
}

// ── Presets ──

/** Login endpoints: 10/min per IP (moderate) */
export function loginRateLimit(routeName?: string) {
  return createRateLimitMiddleware({
    limit: 10,
    windowMs: 60_000,
    keyBuilder: ipKey,
    routeName: routeName || "login",
  });
}

/** Forgot-password: 5/min per IP (strict) */
export function forgotPasswordRateLimit(routeName?: string) {
  return createRateLimitMiddleware({
    limit: 5,
    windowMs: 60_000,
    keyBuilder: ipKey,
    routeName: routeName || "forgot-password",
  });
}

/** Reset-password: 5/min per IP (strict) */
export function resetPasswordRateLimit(routeName?: string) {
  return createRateLimitMiddleware({
    limit: 5,
    windowMs: 60_000,
    keyBuilder: ipKey,
    routeName: routeName || "reset-password",
  });
}

/** MFA verify/challenge/setup: 10/min per user+IP */
export function mfaRateLimit(routeName?: string) {
  return createRateLimitMiddleware({
    limit: 10,
    windowMs: 60_000,
    keyBuilder: ipUserKey,
    routeName: routeName || "mfa",
  });
}

/** WebAuthn options/verify: 20/min per IP */
export function webauthnRateLimit(routeName?: string) {
  return createRateLimitMiddleware({
    limit: 20,
    windowMs: 60_000,
    keyBuilder: ipKey,
    routeName: routeName || "webauthn",
  });
}

/** Invite/resend: 30/hour per org */
export function inviteRateLimit(routeName?: string) {
  return createRateLimitMiddleware({
    limit: 30,
    windowMs: 3_600_000,
    keyBuilder: orgKey,
    routeName: routeName || "invite",
  });
}

/** Recovery request: 3/day per user */
export function recoveryRequestRateLimit(routeName?: string) {
  return createRateLimitMiddleware({
    limit: 3,
    windowMs: 86_400_000,
    keyBuilder: userKey,
    routeName: routeName || "recovery-request",
  });
}

/** Emergency generate/use: 5/hour per user */
export function emergencyRateLimit(routeName?: string) {
  return createRateLimitMiddleware({
    limit: 5,
    windowMs: 3_600_000,
    keyBuilder: ipUserKey,
    routeName: routeName || "emergency",
  });
}

/** Change password: 5/min per IP */
export function changePasswordRateLimit(routeName?: string) {
  return createRateLimitMiddleware({
    limit: 5,
    windowMs: 60_000,
    keyBuilder: ipKey,
    routeName: routeName || "change-password",
  });
}

/** Signup: 5/min per IP + 3/min per email */
export function signupRateLimit(routeName?: string) {
  return createRateLimitMiddleware({
    limit: 5,
    windowMs: 60_000,
    keyBuilder: ipEmailKey,
    routeName: routeName || "signup",
  });
}

/** Signup strict IP rule: 3 signups per hour */
export function signupIpRateLimit(routeName?: string) {
  return createRateLimitMiddleware({
    limit: 3,
    windowMs: 3_600_000,
    keyBuilder: ipKey,
    routeName: routeName || "signup-ip",
  });
}

/** Signup strict email rule: 1 signup per 24h per email */
export function signupEmailRateLimit(routeName?: string) {
  return createRateLimitMiddleware({
    limit: 1,
    windowMs: 86_400_000,
    keyBuilder: emailOnlyKey,
    routeName: routeName || "signup-email",
  });
}

/** Verify email: 10/min per IP */
export function verifyEmailRateLimit(routeName?: string) {
  return createRateLimitMiddleware({
    limit: 10,
    windowMs: 60_000,
    keyBuilder: ipKey,
    routeName: routeName || "verify-email",
  });
}

/** Resend verification: 3 attempts per email per 2 hours, then locked out */
export function resendVerificationRateLimit(routeName?: string) {
  return createRateLimitMiddleware({
    limit: 3,
    windowMs: 7_200_000, // 2 hours
    keyBuilder: emailOnlyKey,
    routeName: routeName || "resend-verification",
  });
}

/** Generic: for caller-specified limits */
export function genericRateLimit(config: RateLimitConfig) {
  return createRateLimitMiddleware(config);
}
