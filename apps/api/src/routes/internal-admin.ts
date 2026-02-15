/**
 * Internal Admin Routes
 * 
 * Protected endpoints for administrative operations.
 * All routes require admin authentication via session cookie.
 */

import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requireAdmin } from "../middleware/require-admin";
import { requireStepUp } from "../middleware/require-step-up";
import { hashPassword } from "../utils/password";
import crypto from "crypto";
import {
  createCheckoutSession,
  createCustomerPortalSession,
  extractPromoPercentFromCode,
  isStripeConfigured,
  PromoCodeInvalidError,
  syncPromoCodeWithStripe,
  StripeNotConfiguredError,
} from "../utils/stripe";
import { createRateLimitMiddleware } from "../middleware/rate-limit";
import { reconcileOrgBilling } from "../utils/billing-reconcile";
import { writeAuditLog } from "../utils/audit-log";
import { getMonthKey, getUsageForMonth, getPlanLimits } from "../utils/entitlements";

interface RetentionRunResult {
  ok: boolean;
  orgsProcessed: number;
  messagesDeleted: number;
  messagesRedacted: number;
  duration_ms: number;
  timestamp: string;
}

interface CreateOrgRequest {
  name: string;
  key?: string;
  allowedDomains?: string[];
  allowLocalhost?: boolean;
}

interface OrgListItem {
  id: string;
  key: string;
  name: string;
  siteId: string;
  allowLocalhost: boolean;
  allowedDomains: string[];
  createdAt: string;
  updatedAt: string;
}

interface CreateOrgUserRequest {
  email: string;
  role?: "owner" | "admin" | "agent";
  password?: string;
}

/**
 * Generate a unique org key from name
 * Format: slug-XXXX (where XXXX is 4 random alphanumeric chars)
 */
function generateOrgKey(name: string): string {
  // Convert to slug: lowercase, replace spaces/special chars with hyphens
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .substring(0, 20); // Max 20 chars for slug part

  // Add 4 random alphanumeric chars for uniqueness
  const suffix = Array.from({ length: 4 }, () => 
    '0123456789abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 36)]
  ).join('');

  return `${slug}-${suffix}`;
}

/**
 * Generate a unique site ID
 * Format: site_XXXXXXXXXXXXXXXX (16 random alphanumeric chars)
 */
function generateSiteId(): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const randomPart = Array.from({ length: 16 }, () => 
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
  return `site_${randomPart}`;
}

function normalizePromoCode(code: string): string {
  return code.trim().toUpperCase();
}

function isValidPromoCode(code: string): boolean {
  return /^[A-Z0-9]{4,20}$/.test(code);
}

export async function internalAdminRoutes(fastify: FastifyInstance) {
  /**
   * GET /internal/orgs
   * 
   * List all organizations (admin only)
   * 
   * Returns array of orgs with key fields for admin dashboard
   */
  fastify.get("/internal/orgs", {
    preHandler: [requireAdmin],
  }, async (request, reply) => {
    const orgs = await prisma.organization.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        key: true,
        name: true,
        siteId: true,
        allowLocalhost: true,
        allowedDomains: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const result: OrgListItem[] = orgs.map(org => ({
      id: org.id,
      key: org.key,
      name: org.name,
      siteId: org.siteId,
      allowLocalhost: org.allowLocalhost,
      allowedDomains: org.allowedDomains,
      createdAt: org.createdAt.toISOString(),
      updatedAt: org.updatedAt.toISOString(),
    }));

    return result;
  });

  /**
   * POST /internal/orgs
   * 
   * Create a new organization (admin only)
   * 
   * Body:
   *   - name: string (required)
   *   - key: string (optional, auto-generated from name if missing)
   *   - allowedDomains: string[] (optional)
   *   - allowLocalhost: boolean (optional, default true)
   * 
   * Returns created org
   */
  fastify.post<{ Body: CreateOrgRequest }>("/internal/orgs", {
    preHandler: [requireAdmin],
  }, async (request, reply) => {
    const { name, key, allowedDomains, allowLocalhost } = request.body;

    // Validate name
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      reply.code(400);
      return { error: "Organization name is required" };
    }

    if (name.length > 100) {
      reply.code(400);
      return { error: "Organization name must be 100 characters or less" };
    }

    // Generate or validate key
    let orgKey = key;
    if (!orgKey) {
      // Generate unique key from name
      let attempts = 0;
      const maxAttempts = 10;
      
      while (attempts < maxAttempts) {
        orgKey = generateOrgKey(name);
        
        // Check if key already exists
        const existing = await prisma.organization.findUnique({
          where: { key: orgKey },
        });
        
        if (!existing) {
          break; // Key is unique
        }
        
        attempts++;
      }
      
      if (attempts === maxAttempts) {
        reply.code(500);
        return { error: "Failed to generate unique organization key" };
      }
    } else {
      // Validate provided key
      if (!/^[a-z0-9-]+$/.test(orgKey)) {
        reply.code(400);
        return { error: "Organization key must contain only lowercase letters, numbers, and hyphens" };
      }

      if (orgKey.length > 64) {
        reply.code(400);
        return { error: "Organization key must be 64 characters or less" };
      }

      // Check if key already exists
      const existing = await prisma.organization.findUnique({
        where: { key: orgKey },
      });
      
      if (existing) {
        reply.code(409);
        return { error: "Organization key already exists" };
      }
    }

    // Generate unique siteId
    let siteId: string;
    let siteIdAttempts = 0;
    const maxSiteIdAttempts = 10;
    
    while (siteIdAttempts < maxSiteIdAttempts) {
      siteId = generateSiteId();
      
      // Check if siteId already exists
      const existing = await prisma.organization.findUnique({
        where: { siteId },
      });
      
      if (!existing) {
        break; // siteId is unique
      }
      
      siteIdAttempts++;
    }
    
    if (siteIdAttempts === maxSiteIdAttempts) {
      reply.code(500);
      return { error: "Failed to generate unique site ID" };
    }

    // Create organization with defaults
    const org = await prisma.organization.create({
      data: {
        key: orgKey!,
        name: name.trim(),
        siteId: siteId!,
        allowedDomains: allowedDomains || [],
        allowLocalhost: allowLocalhost !== undefined ? allowLocalhost : true,
        widgetEnabled: true,
        writeEnabled: true,
        aiEnabled: true,
        primaryColor: '#0F5C5C',
        widgetName: name.trim(),
        widgetSubtitle: 'AI Chat Assistant',
        language: 'en',
        position: 'right',
        messageRetentionDays: 365,
        hardDeleteOnRetention: false,
        lastRetentionRunAt: null,
      },
    });

    request.log.info({
      orgKey: org.key,
      orgId: org.id,
      name: org.name,
      siteId: org.siteId,
    }, "Organization created by admin");

    const result: OrgListItem = {
      id: org.id,
      key: org.key,
      name: org.name,
      siteId: org.siteId,
      allowLocalhost: org.allowLocalhost,
      allowedDomains: org.allowedDomains,
      createdAt: org.createdAt.toISOString(),
      updatedAt: org.updatedAt.toISOString(),
    };

    reply.code(201);
    return result;
  });

  /**
   * GET /internal/org/:key/billing
   *
   * Get billing settings for an organization (admin only)
   */
  fastify.get<{ Params: { key: string } }>(
    "/internal/org/:key/billing",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { key } = request.params;
      const org = await prisma.organization.findUnique({
        where: { key },
      });

      if (!org) {
        reply.code(404);
        return { error: "Organization not found" };
      }

      return {
        stripeConfigured: isStripeConfigured(),
        org: {
          id: org.id,
          key: org.key,
          name: org.name,
        },
        billing: {
          stripeCustomerId: org.stripeCustomerId,
          stripeSubscriptionId: org.stripeSubscriptionId,
          stripePriceId: org.stripePriceId,
          billingStatus: org.billingStatus,
          currentPeriodEnd: org.currentPeriodEnd?.toISOString() || null,
          cancelAtPeriodEnd: org.cancelAtPeriodEnd,
          billingEnforced: org.billingEnforced,
          billingGraceDays: org.billingGraceDays,
          lastStripeEventAt: org.lastStripeEventAt?.toISOString() || null,
        },
      };
    }
  );

  /**
   * PATCH /internal/org/:key/billing
   *
   * Update billing enforcement settings (admin only)
   */
  fastify.patch<{ Params: { key: string } }>(
    "/internal/org/:key/billing",
    { preHandler: [requireAdmin, requireStepUp("admin")] },
    async (request, reply) => {
      const { key } = request.params;
      const { billingEnforced, billingGraceDays } = request.body as {
        billingEnforced?: boolean;
        billingGraceDays?: number;
      };

      const updateData: Record<string, unknown> = {};

      if (billingEnforced !== undefined) {
        if (typeof billingEnforced !== "boolean") {
          reply.code(400);
          return { error: "billingEnforced must be boolean" };
        }
        updateData.billingEnforced = billingEnforced;
      }

      if (billingGraceDays !== undefined) {
        if (
          typeof billingGraceDays !== "number" ||
          billingGraceDays < 0 ||
          billingGraceDays > 365
        ) {
          reply.code(400);
          return { error: "billingGraceDays must be between 0 and 365" };
        }
        updateData.billingGraceDays = billingGraceDays;
      }

      if (Object.keys(updateData).length === 0) {
        return { ok: true, updated: false };
      }

      const org = await prisma.organization.update({
        where: { key },
        data: updateData,
      });

      return {
        ok: true,
        billing: {
          billingEnforced: org.billingEnforced,
          billingGraceDays: org.billingGraceDays,
        },
      };
    }
  );

  /**
   * POST /internal/org/:key/billing/checkout-session
   */
  fastify.post<{ Params: { key: string } }>(
    "/internal/org/:key/billing/checkout-session",
    { preHandler: [requireAdmin, requireStepUp("admin")] },
    async (request, reply) => {
      const { key } = request.params;
      const { returnUrl } = request.body as { returnUrl?: string };

      const org = await prisma.organization.findUnique({
        where: { key },
      });
      if (!org) {
        reply.code(404);
        return { error: "Organization not found" };
      }

      try {
        const checkout = await createCheckoutSession(org.id, returnUrl);
        return { url: checkout.url };
      } catch (err) {
        if (err instanceof StripeNotConfiguredError) {
          reply.code(400);
          return { error: "Stripe not configured" };
        }
        reply.code(500);
        return { error: "Checkout session failed" };
      }
    }
  );

  /**
   * POST /internal/org/:key/billing/portal-session
   */
  fastify.post<{ Params: { key: string } }>(
    "/internal/org/:key/billing/portal-session",
    { preHandler: [requireAdmin, requireStepUp("admin")] },
    async (request, reply) => {
      const { key } = request.params;
      const { returnUrl } = request.body as { returnUrl?: string };

      const org = await prisma.organization.findUnique({
        where: { key },
      });
      if (!org) {
        reply.code(404);
        return { error: "Organization not found" };
      }

      try {
        const url = await createCustomerPortalSession(org.id, returnUrl);
        return { url };
      } catch (err) {
        if (err instanceof StripeNotConfiguredError) {
          reply.code(400);
          return { error: "Stripe not configured" };
        }
        reply.code(500);
        return { error: "Portal session failed" };
      }
    }
  );

  /**
   * POST /internal/billing/reconcile
   *
   * Reconcile billing state with Stripe (admin only)
   */
  fastify.post<{
    Body: { orgKey?: string; dryRun?: boolean; limit?: number };
  }>(
    "/internal/billing/reconcile",
    {
      preHandler: [
        requireAdmin,
        requireStepUp("admin"),
        createRateLimitMiddleware({ limit: 5, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      if (!isStripeConfigured()) {
        reply.code(501);
        return { ok: false, error: "Stripe not configured" };
      }

      const { orgKey, dryRun, limit } = request.body || {};
      const take =
        typeof limit === "number" && limit > 0 ? Math.min(limit, 200) : 50;

      let orgs: { id: string; key: string; stripeCustomerId: string | null }[] =
        [];

      if (orgKey) {
        const org = await prisma.organization.findUnique({
          where: { key: orgKey },
          select: { id: true, key: true, stripeCustomerId: true },
        });
        if (!org) {
          reply.code(404);
          return { ok: false, error: "Organization not found" };
        }
        orgs = [org];
      } else {
        orgs = await prisma.organization.findMany({
          where: { stripeCustomerId: { not: null } },
          orderBy: { updatedAt: "desc" },
          take,
          select: { id: true, key: true, stripeCustomerId: true },
        });
      }

      let orgsUpdated = 0;
      const results = [];
      const errors = [];

      for (const org of orgs) {
        try {
          const result = await reconcileOrgBilling(org.id, {
            dryRun: Boolean(dryRun),
          });
          if (result.updated) orgsUpdated += 1;
          if (result.error) {
            errors.push({ orgKey: org.key, error: result.error });
          }
          results.push(result);
        } catch (error) {
          errors.push({
            orgKey: org.key,
            error: error instanceof Error ? error.message : "Unknown error",
          });
          results.push({
            orgId: org.id,
            orgKey: org.key,
            updated: false,
            dryRun: Boolean(dryRun),
            changes: [],
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      return {
        ok: true,
        dryRun: Boolean(dryRun),
        orgsScanned: orgs.length,
        orgsUpdated,
        errors,
        results,
      };
    }
  );

  // ────────────────────────────────────────────────
  // Promo code management (admin)
  // GET /internal/promo-codes?orgKey=...
  // POST /internal/promo-codes
  // PATCH /internal/promo-codes/:id
  // ────────────────────────────────────────────────
  fastify.get<{ Querystring: { orgKey?: string } }>(
    "/internal/promo-codes",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const orgKey = request.query.orgKey?.trim();
      if (!orgKey) {
        reply.code(400);
        return { error: "orgKey is required" };
      }

      const org = await prisma.organization.findUnique({
        where: { key: orgKey },
        select: { id: true },
      });
      if (!org) {
        reply.code(404);
        return { error: "Organization not found" };
      }

      const items = await prisma.promoCode.findMany({
        where: {
          OR: [{ createdBy: org.id }, { isGlobal: true }],
        },
        orderBy: { createdAt: "desc" },
      });
      return { items };
    }
  );

  fastify.post<{
    Body: {
      orgKey?: string;
      code?: string;
      maxUses?: number | null;
      validUntil?: string | null;
      isGlobal?: boolean;
    };
  }>(
    "/internal/promo-codes",
    { preHandler: [requireAdmin, requireStepUp("admin")] },
    async (request, reply) => {
      const body = request.body || {};
      const orgKey = body.orgKey?.trim();
      if (!orgKey) {
        reply.code(400);
        return { error: "orgKey is required" };
      }

      const org = await prisma.organization.findUnique({
        where: { key: orgKey },
        select: { id: true },
      });
      if (!org) {
        reply.code(404);
        return { error: "Organization not found" };
      }

      if (!body.code || typeof body.code !== "string") {
        reply.code(400);
        return { error: "code is required" };
      }
      const code = normalizePromoCode(body.code);
      if (!isValidPromoCode(code)) {
        reply.code(400);
        return { error: "code must be 4-20 characters and alphanumeric" };
      }

      const parsedPercent = extractPromoPercentFromCode(code);
      if (!parsedPercent) {
        reply.code(400);
        return {
          error:
            "Promo code must end with a percentage number (e.g. WELCOME20).",
        };
      }

      if (
        body.maxUses !== undefined &&
        body.maxUses !== null &&
        (!Number.isInteger(body.maxUses) || body.maxUses <= 0)
      ) {
        reply.code(400);
        return { error: "maxUses must be a positive integer or null" };
      }

      let validUntil: Date | null = null;
      if (body.validUntil) {
        validUntil = new Date(body.validUntil);
        if (Number.isNaN(validUntil.getTime())) {
          reply.code(400);
          return { error: "validUntil must be a valid date" };
        }
      }

      try {
        const created = await prisma.promoCode.create({
          data: {
            id: crypto.randomUUID(),
            code,
            discountType: "percentage",
            discountValue: parsedPercent,
            maxUses: body.maxUses ?? null,
            currentUses: 0,
            validFrom: new Date(),
            validUntil,
            isActive: true,
            isGlobal: body.isGlobal === true,
            createdBy: org.id,
          },
        });

        if (isStripeConfigured()) {
          try {
            const synced = await syncPromoCodeWithStripe({
              id: created.id,
              code: created.code,
              stripeCouponId: created.stripeCouponId,
              stripePromotionCodeId: created.stripePromotionCodeId,
            });
            const updated = await prisma.promoCode.update({
              where: { id: created.id },
              data: {
                discountType: "percentage",
                discountValue: synced.percent,
                stripeCouponId: synced.stripeCouponId,
                stripePromotionCodeId: synced.stripePromotionCodeId,
              },
            });
            return { ok: true, promoCode: updated };
          } catch (syncError) {
            if (syncError instanceof PromoCodeInvalidError) {
              reply.code(400);
              return { error: syncError.message };
            }
            request.log.error(syncError, "promo code stripe sync failed");
          }
        }

        return { ok: true, promoCode: created };
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: string }).code === "P2002"
        ) {
          reply.code(409);
          return { error: "Promo code already exists" };
        }
        request.log.error(error, "promo code create failed");
        reply.code(500);
        return { error: "Promo code create failed" };
      }
    }
  );

  fastify.patch<{
    Params: { id: string };
    Body: { orgKey?: string; isActive?: boolean };
  }>(
    "/internal/promo-codes/:id",
    { preHandler: [requireAdmin, requireStepUp("admin")] },
    async (request, reply) => {
      const orgKey = request.body.orgKey?.trim();
      if (!orgKey) {
        reply.code(400);
        return { error: "orgKey is required" };
      }
      if (typeof request.body.isActive !== "boolean") {
        reply.code(400);
        return { error: "isActive must be boolean" };
      }

      const org = await prisma.organization.findUnique({
        where: { key: orgKey },
        select: { id: true },
      });
      if (!org) {
        reply.code(404);
        return { error: "Organization not found" };
      }

      const owned = await prisma.promoCode.findFirst({
        where: {
          id: request.params.id,
          OR: [{ createdBy: org.id }, { isGlobal: true }],
        },
        select: { id: true },
      });
      if (!owned) {
        reply.code(404);
        return { error: "Promo code not found" };
      }

      const updated = await prisma.promoCode.update({
        where: { id: request.params.id },
        data: { isActive: request.body.isActive },
      });

      return { ok: true, promoCode: updated };
    }
  );

  /**
   * POST /internal/org/:key/users
   *
   * Create org user for onboarding (admin only)
   * Body:
   *   - email: string (required)
   *   - role: "owner" | "admin" | "agent" (optional, default "owner")
   *   - password: string (optional, temp password generated if missing)
   */
  fastify.post<{ Params: { key: string }; Body: CreateOrgUserRequest }>(
    "/internal/org/:key/users",
    {
      preHandler: [requireAdmin, requireStepUp("admin")],
    },
    async (request, reply) => {
      const { key } = request.params;
      const { email, role, password } = request.body;

      if (!email || typeof email !== "string") {
        reply.code(400);
        return { error: "Email is required" };
      }

      const org = await prisma.organization.findUnique({
        where: { key },
      });

      if (!org) {
        reply.code(404);
        return { error: "Organization not found" };
      }

      const existing = await prisma.orgUser.findUnique({
        where: { email: email.toLowerCase().trim() },
      });

      if (existing) {
        reply.code(409);
        return { error: "User already exists" };
      }

      const tempPassword =
        password ||
        crypto
          .randomBytes(9)
          .toString("base64")
          .replace(/[^a-zA-Z0-9]/g, "")
          .slice(0, 12);

      const passwordHash = await hashPassword(tempPassword);
      const userRole = role || "owner";

      const user = await prisma.orgUser.create({
        data: {
          email: email.toLowerCase().trim(),
          passwordHash,
          role: userRole,
          orgId: org.id,
        },
      });

      return {
        ok: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          orgId: org.id,
          orgKey: org.key,
        },
        tempPassword: password ? undefined : tempPassword,
      };
    }
  );

  // ────────────────────────────────────────────────
  // GET /internal/org/:key/usage
  // Returns current month usage, limits (incl extra quota), next reset date
  // ────────────────────────────────────────────────
  fastify.get<{ Params: { key: string } }>(
    "/internal/org/:key/usage",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { key } = request.params;
      const org = await prisma.organization.findUnique({
        where: { key },
        select: { id: true, key: true, name: true },
      });
      if (!org) {
        reply.code(404);
        return { error: "Organization not found" };
      }

      const [usage, limits] = await Promise.all([
        getUsageForMonth(org.id),
        getPlanLimits(org.id),
      ]);

      return {
        org: { id: org.id, key: org.key, name: org.name },
        usage,
        limits,
      };
    }
  );

  // ────────────────────────────────────────────────
  // POST /internal/org/:key/usage/reset
  // Admin override: reset current month usage counters to zero
  // ────────────────────────────────────────────────
  fastify.post<{ Params: { key: string } }>(
    "/internal/org/:key/usage/reset",
    { preHandler: [requireAdmin, requireStepUp("admin")] },
    async (request, reply) => {
      const { key } = request.params;
      const org = await prisma.organization.findUnique({
        where: { key },
        select: { id: true, key: true },
      });
      if (!org) {
        reply.code(404);
        return { error: "Organization not found" };
      }

      const monthKey = getMonthKey();
      await prisma.usage.upsert({
        where: { orgId_monthKey: { orgId: org.id, monthKey } },
        update: { conversationsCreated: 0, messagesSent: 0 },
        create: { orgId: org.id, monthKey, conversationsCreated: 0, messagesSent: 0 },
      });

      const adminEmail = (request.session as unknown as Record<string, unknown>)?.adminEmail as string || "admin";
      await writeAuditLog(org.id, adminEmail, "usage.reset", { monthKey });

      return { ok: true, monthKey, message: "Usage counters reset to zero" };
    }
  );

  // ────────────────────────────────────────────────
  // POST /internal/org/:key/usage/grant-quota
  // Admin override: grant extra quota on top of plan limits
  // Body: { extraConversations?: number, extraMessages?: number }
  // ────────────────────────────────────────────────
  fastify.post<{ Params: { key: string } }>(
    "/internal/org/:key/usage/grant-quota",
    { preHandler: [requireAdmin, requireStepUp("admin")] },
    async (request, reply) => {
      const { key } = request.params;
      const body = request.body as {
        extraConversations?: number;
        extraMessages?: number;
      };

      if (
        (body.extraConversations !== undefined &&
          (typeof body.extraConversations !== "number" || body.extraConversations < 0)) ||
        (body.extraMessages !== undefined &&
          (typeof body.extraMessages !== "number" || body.extraMessages < 0))
      ) {
        reply.code(400);
        return { error: "Quota values must be non-negative numbers" };
      }

      const org = await prisma.organization.findUnique({
        where: { key },
        select: { id: true, key: true, extraConversationQuota: true, extraMessageQuota: true },
      });
      if (!org) {
        reply.code(404);
        return { error: "Organization not found" };
      }

      const updateData: Record<string, number> = {};
      if (body.extraConversations !== undefined) {
        updateData.extraConversationQuota = body.extraConversations;
      }
      if (body.extraMessages !== undefined) {
        updateData.extraMessageQuota = body.extraMessages;
      }

      if (Object.keys(updateData).length === 0) {
        return { ok: true, updated: false };
      }

      const updated = await prisma.organization.update({
        where: { key },
        data: updateData,
        select: { extraConversationQuota: true, extraMessageQuota: true },
      });

      const adminEmail = (request.session as unknown as Record<string, unknown>)?.adminEmail as string || "admin";
      await writeAuditLog(org.id, adminEmail, "quota.grant", {
        previous: {
          extraConversationQuota: org.extraConversationQuota,
          extraMessageQuota: org.extraMessageQuota,
        },
        current: updated,
      });

      return {
        ok: true,
        extraConversationQuota: updated.extraConversationQuota,
        extraMessageQuota: updated.extraMessageQuota,
      };
    }
  );

  // ────────────────────────────────────────────────
  // POST /internal/org/:key/billing/lock
  // Admin override: manually lock billing (block writes)
  // ────────────────────────────────────────────────
  fastify.post<{ Params: { key: string } }>(
    "/internal/org/:key/billing/lock",
    { preHandler: [requireAdmin, requireStepUp("admin")] },
    async (request, reply) => {
      const { key } = request.params;
      const org = await prisma.organization.findUnique({
        where: { key },
        select: { id: true, billingLockedAt: true },
      });
      if (!org) {
        reply.code(404);
        return { error: "Organization not found" };
      }

      if (org.billingLockedAt) {
        return { ok: true, message: "Already locked" };
      }

      await prisma.organization.update({
        where: { key },
        data: { billingLockedAt: new Date() },
      });

      const adminEmail = (request.session as unknown as Record<string, unknown>)?.adminEmail as string || "admin";
      await writeAuditLog(org.id, adminEmail, "billing.lock", { manual: true });

      // Emit notification to owners
      const { emitBillingLocked } = await import("../utils/notifications");
      await emitBillingLocked(org.id, request.requestId);

      return { ok: true, message: "Billing locked — writes are now blocked" };
    }
  );

  // ────────────────────────────────────────────────
  // POST /internal/org/:key/billing/unlock
  // Admin override: manually unlock billing (allow writes)
  // ────────────────────────────────────────────────
  fastify.post<{ Params: { key: string } }>(
    "/internal/org/:key/billing/unlock",
    { preHandler: [requireAdmin, requireStepUp("admin")] },
    async (request, reply) => {
      const { key } = request.params;
      const org = await prisma.organization.findUnique({
        where: { key },
        select: { id: true, billingLockedAt: true },
      });
      if (!org) {
        reply.code(404);
        return { error: "Organization not found" };
      }

      if (!org.billingLockedAt) {
        return { ok: true, message: "Already unlocked" };
      }

      await prisma.organization.update({
        where: { key },
        data: { billingLockedAt: null, graceEndsAt: null },
      });

      const adminEmail = (request.session as unknown as Record<string, unknown>)?.adminEmail as string || "admin";
      await writeAuditLog(org.id, adminEmail, "billing.unlock", { manual: true });

      // Emit notification to owners
      const { emitBillingUnlocked } = await import("../utils/notifications");
      await emitBillingUnlocked(org.id, request.requestId);

      return { ok: true, message: "Billing unlocked — writes are now allowed" };
    }
  );

  // ────────────────────────────────────────────────
  // GET /internal/org/:key/audit-log
  // Returns recent audit log entries for an org
  // ────────────────────────────────────────────────
  fastify.get<{ Params: { key: string }; Querystring: { limit?: string } }>(
    "/internal/org/:key/audit-log",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { key } = request.params;
      const org = await prisma.organization.findUnique({
        where: { key },
        select: { id: true },
      });
      if (!org) {
        reply.code(404);
        return { error: "Organization not found" };
      }

      const take = Math.min(Math.max(parseInt(request.query.limit || "50", 10) || 50, 1), 200);
      const entries = await prisma.auditLog.findMany({
        where: { orgId: org.id },
        orderBy: { createdAt: "desc" },
        take,
      });

      return { entries };
    }
  );

  /**
   * POST /internal/retention/run
   * 
   * Run data retention policy across all organizations.
   * 
   * For each organization with messageRetentionDays set:
   * - Find messages older than (now - retentionDays)
   * - If hardDeleteOnRetention=true: DELETE messages
   * - If hardDeleteOnRetention=false: REDACT content (set to "[redacted]")
   * 
   * Authentication: Requires x-internal-key header
   * 
   * Response (200):
   *   {
   *     ok: true,
   *     orgsProcessed: number,
   *     messagesDeleted: number,
   *     messagesRedacted: number,
   *     duration_ms: number,
   *     timestamp: ISO string
   *   }
   * 
   * Safety:
   * - Only processes orgs with messageRetentionDays > 0
   * - Uses transactions for atomic operations
   * - Logs detailed audit trail
   * - Updates lastRetentionRunAt timestamp
   */
  fastify.post("/internal/retention/run", {
    preHandler: [requireAdmin, requireStepUp("admin")],
  }, async (request, reply) => {
    const startTime = Date.now();
    
    request.log.info("🗑️  Starting retention policy run");

    let orgsProcessed = 0;
    let messagesDeleted = 0;
    let messagesRedacted = 0;

    try {
      // Get all organizations with retention policy enabled
      const orgs = await prisma.organization.findMany({
        where: {
          messageRetentionDays: {
            gt: 0, // Only process orgs with positive retention days
          },
        },
        select: {
          id: true,
          key: true,
          name: true,
          messageRetentionDays: true,
          hardDeleteOnRetention: true,
        },
      });

      request.log.info({ orgCount: orgs.length }, "Found organizations with retention policy");

      for (const org of orgs) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - org.messageRetentionDays);

        request.log.info({
          orgKey: org.key,
          retentionDays: org.messageRetentionDays,
          cutoffDate: cutoffDate.toISOString(),
          hardDelete: org.hardDeleteOnRetention,
        }, "Processing retention for organization");

        // Find old messages
        const oldMessages = await prisma.message.findMany({
          where: {
            orgId: org.id,
            timestamp: {
              lt: cutoffDate,
            },
          },
          select: {
            id: true,
            timestamp: true,
          },
        });

        if (oldMessages.length === 0) {
          request.log.info({ orgKey: org.key }, "No messages to process");
          continue;
        }

        request.log.info({
          orgKey: org.key,
          messageCount: oldMessages.length,
        }, "Found messages for retention processing");

        // Process messages based on hardDeleteOnRetention flag
        if (org.hardDeleteOnRetention) {
          // Hard delete
          const deleted = await prisma.message.deleteMany({
            where: {
              id: {
                in: oldMessages.map((m) => m.id),
              },
            },
          });

          messagesDeleted += deleted.count;

          request.log.info({
            orgKey: org.key,
            deletedCount: deleted.count,
          }, "Messages hard deleted");
        } else {
          // Soft delete (redact content)
          const messageIds = oldMessages.map((m) => m.id);

          // Update in batches of 1000 for safety
          const batchSize = 1000;
          for (let i = 0; i < messageIds.length; i += batchSize) {
            const batch = messageIds.slice(i, i + batchSize);
            
            const updated = await prisma.message.updateMany({
              where: {
                id: {
                  in: batch,
                },
              },
              data: {
                content: "[redacted]",
              },
            });

            messagesRedacted += updated.count;
          }

          request.log.info({
            orgKey: org.key,
            redactedCount: messagesRedacted,
          }, "Messages redacted");
        }

        // Update lastRetentionRunAt for this org
        await prisma.organization.update({
          where: { id: org.id },
          data: {
            lastRetentionRunAt: new Date(),
          },
        });

        orgsProcessed++;
      }

      const duration_ms = Date.now() - startTime;

      const result: RetentionRunResult = {
        ok: true,
        orgsProcessed,
        messagesDeleted,
        messagesRedacted,
        duration_ms,
        timestamp: new Date().toISOString(),
      };

      request.log.info(result, "✅ Retention policy run completed");

      return result;
    } catch (error) {
      request.log.error({ error }, "❌ Retention policy run failed");

      reply.code(500);
      return {
        ok: false,
        error: "Retention run failed",
        message: error instanceof Error ? error.message : "Unknown error",
        orgsProcessed,
        messagesDeleted,
        messagesRedacted,
      };
    }
  });
}
