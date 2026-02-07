/**
 * Signed Link Generation & Verification — Step 11.27
 *
 * Generates HMAC-signed URLs for email flows:
 * - Portal invites
 * - Password reset
 * - Recovery approval notification
 * - Emergency access notification
 *
 * Links include: token, expiry, HMAC signature.
 * Verification checks: signature validity, expiry, single-use (caller enforces).
 */

import crypto from "crypto";

// ── Config ──

function getAppUrl(): string {
  return process.env.APP_PUBLIC_URL || process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000";
}

function getSigningSecret(): string {
  return process.env.SIGNED_LINK_SECRET || process.env.SESSION_SECRET || "dev-signing-secret";
}

// ── Link Types ──

export type LinkType = "invite" | "reset" | "recovery" | "emergency" | "verify_email";

interface SignedLinkParams {
  type: LinkType;
  token: string;
  expiresAt: Date;
  extra?: Record<string, string>; // additional query params
}

interface SignedLinkResult {
  url: string;
  signature: string;
  expiresAt: Date;
}

interface VerifyResult {
  valid: boolean;
  token?: string;
  type?: LinkType;
  expired?: boolean;
  error?: string;
}

// ── Path mapping ──

const LINK_PATHS: Record<LinkType, string> = {
  invite: "/portal/accept-invite",
  reset: "/portal/reset-password",
  recovery: "/portal/recovery",
  emergency: "/portal/recovery",
  verify_email: "/portal/verify-email",
};

// ── Core Functions ──

/**
 * Generate a signed link for email delivery.
 */
export function generateSignedLink(params: SignedLinkParams): SignedLinkResult {
  const appUrl = getAppUrl();
  const path = LINK_PATHS[params.type];
  const expiresMs = params.expiresAt.getTime();

  // Build the data to sign
  const dataToSign = `${params.type}:${params.token}:${expiresMs}`;
  const signature = createHmac(dataToSign);

  // Build URL
  const url = new URL(path, appUrl);
  url.searchParams.set("token", params.token);
  url.searchParams.set("expires", expiresMs.toString());
  url.searchParams.set("sig", signature);

  // Add extra params
  if (params.extra) {
    for (const [key, value] of Object.entries(params.extra)) {
      url.searchParams.set(key, value);
    }
  }

  return {
    url: url.toString(),
    signature,
    expiresAt: params.expiresAt,
  };
}

/**
 * Verify a signed link's signature and expiry.
 * Note: Single-use enforcement must be done by the caller (e.g., check token usedAt).
 */
export function verifySignedLink(
  urlString: string
): VerifyResult {
  try {
    const url = new URL(urlString);
    const token = url.searchParams.get("token");
    const expiresStr = url.searchParams.get("expires");
    const sig = url.searchParams.get("sig");

    if (!token || !expiresStr || !sig) {
      return { valid: false, error: "Missing required parameters" };
    }

    const expiresMs = parseInt(expiresStr, 10);
    if (isNaN(expiresMs)) {
      return { valid: false, error: "Invalid expiry" };
    }

    // Check expiry
    if (Date.now() > expiresMs) {
      return { valid: false, expired: true, error: "Link has expired" };
    }

    // Detect type from path
    const path = url.pathname;
    let type: LinkType | undefined;
    for (const [t, p] of Object.entries(LINK_PATHS)) {
      if (path === p || path.endsWith(p)) {
        type = t as LinkType;
        break;
      }
    }

    if (!type) {
      return { valid: false, error: "Unknown link type" };
    }

    // Verify HMAC
    const dataToSign = `${type}:${token}:${expiresMs}`;
    const expectedSig = createHmac(dataToSign);

    if (!timingSafeCompare(sig, expectedSig)) {
      return { valid: false, error: "Invalid signature" };
    }

    return { valid: true, token, type };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : "Parse error" };
  }
}

// ── Convenience helpers for specific flows ──

/**
 * Generate a portal invite signed link.
 */
export function generateInviteLink(token: string, expiresAt: Date): string {
  return generateSignedLink({ type: "invite", token, expiresAt }).url;
}

/**
 * Generate a password reset signed link.
 */
export function generateResetLink(token: string, expiresAt: Date): string {
  return generateSignedLink({ type: "reset", token, expiresAt }).url;
}

/**
 * Generate a recovery notification link (points to recovery status page).
 */
export function generateRecoveryLink(token: string, expiresAt: Date): string {
  return generateSignedLink({ type: "recovery", token, expiresAt, extra: { flow: "recovery" } }).url;
}

/**
 * Generate an emergency access notification link.
 */
export function generateEmergencyLink(token: string, expiresAt: Date): string {
  return generateSignedLink({ type: "emergency", token, expiresAt, extra: { flow: "emergency" } }).url;
}

/**
 * Generate an email verification signed link.
 */
export function generateVerifyEmailLink(email: string, expiresAt: Date): string {
  return generateSignedLink({
    type: "verify_email",
    token: email,
    expiresAt,
  }).url;
}

/**
 * Verify a verify-email link's HMAC signature + expiry.
 * Returns { valid, email } on success.
 */
export function verifyEmailSignature(
  email: string,
  expiresStr: string,
  sig: string
): { valid: boolean; expired?: boolean; error?: string } {
  const expiresMs = parseInt(expiresStr, 10);
  if (isNaN(expiresMs)) {
    return { valid: false, error: "Invalid expiry" };
  }
  if (Date.now() > expiresMs) {
    return { valid: false, expired: true, error: "Link has expired" };
  }
  const dataToSign = `verify_email:${email}:${expiresMs}`;
  const expectedSig = createHmac(dataToSign);
  if (!timingSafeCompare(sig, expectedSig)) {
    return { valid: false, error: "Invalid signature" };
  }
  return { valid: true };
}

// ── HMAC Helpers ──

function createHmac(data: string): string {
  const secret = getSigningSecret();
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "utf-8"), Buffer.from(b, "utf-8"));
  } catch {
    return false;
  }
}
