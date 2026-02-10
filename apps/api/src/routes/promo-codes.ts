import { randomUUID } from "crypto";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../prisma";
import { requirePortalUser } from "../middleware/require-portal-user";
import { requireAdmin } from "../middleware/require-admin";
import {
  extractPromoPercentFromCode,
  isStripeConfigured,
  PromoCodeInvalidError,
  StripeNotConfiguredError,
  syncPromoCodeWithStripe,
} from "../utils/stripe";

type DiscountType = "percentage" | "fixed";

function isValidDiscountType(value: string): value is DiscountType {
  return value === "percentage" || value === "fixed";
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function isValidCode(code: string): boolean {
  return /^[A-Z0-9]{4,20}$/.test(code);
}

async function resolveAdminOrg(request: FastifyRequest, reply: FastifyReply) {
  const orgKey = request.headers["x-org-key"];
  const normalizedOrgKey = typeof orgKey === "string" ? orgKey.trim() : "";
  if (!normalizedOrgKey) {
    reply.code(400);
    return { error: "x-org-key header is required" };
  }
  const org = await prisma.organization.findUnique({
    where: { key: normalizedOrgKey },
    select: { id: true, key: true },
  });
  if (!org) {
    reply.code(404);
    return { error: "Organization not found" };
  }
  return org;
}

export async function promoCodesRoutes(fastify: FastifyInstance) {
  /* ─── PUBLIC: no auth — returns active global campaign for website banner ─── */
  fastify.get("/active-public", async () => {
    const now = new Date();
    const promo = await prisma.promoCode.findFirst({
      where: {
        isActive: true,
        isGlobal: true,
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gte: now } }],
      },
      orderBy: { createdAt: "desc" },
    });
    if (!promo) return { active: null };
    if (promo.maxUses !== null && promo.currentUses >= promo.maxUses) {
      return { active: null };
    }
    return {
      active: {
        id: promo.id,
        code: promo.code,
        discountType: promo.discountType,
        discountValue: promo.discountValue,
        bannerTitle: promo.bannerTitle || null,
        bannerSubtitle: promo.bannerSubtitle || null,
        validUntil: promo.validUntil?.toISOString() || null,
      },
    };
  });

  fastify.get("/active", { preHandler: [requirePortalUser] }, async (request) => {
    const user = request.portalUser!;
    const settings = await prisma.organizationSettings.findUnique({
      where: { organizationId: user.orgId },
      select: { campaignsEnabled: true },
    });

    const now = new Date();
    const promo = await prisma.promoCode.findFirst({
      where: {
        isActive: true,
        validFrom: { lte: now },
        AND: [
          { OR: [{ validUntil: null }, { validUntil: { gte: now } }] },
          {
            OR: [
              { isGlobal: true },
              ...(settings?.campaignsEnabled ? [{ createdBy: user.orgId, isGlobal: false }] : []),
            ],
          },
        ],
      },
      orderBy: [{ createdAt: "desc" }],
    });

    if (!promo) return { active: null };
    if (promo.maxUses !== null && promo.currentUses >= promo.maxUses) {
      return { active: null };
    }

    return {
      active: {
        id: promo.id,
        code: promo.code,
        isGlobal: promo.isGlobal,
        discountType: promo.discountType,
        discountValue: promo.discountValue,
        bannerTitle: promo.bannerTitle || null,
        bannerSubtitle: promo.bannerSubtitle || null,
        validUntil: promo.validUntil?.toISOString() || null,
      },
    };
  });

  fastify.get("/", { preHandler: [requireAdmin] }, async (request, reply) => {
    const org = await resolveAdminOrg(request, reply);
    if ("error" in org) return org;
    const items = await prisma.promoCode.findMany({
      where: {
        OR: [{ createdBy: org.id }, { isGlobal: true }],
      },
      orderBy: { createdAt: "desc" },
    });
    return { items };
  });

  fastify.post("/", { preHandler: [requireAdmin] }, async (request, reply) => {
    const org = await resolveAdminOrg(request, reply);
    if ("error" in org) return org;
    const body = (request.body || {}) as {
      code?: string;
      discountType?: string;
      discountValue?: number;
      maxUses?: number | null;
      validFrom?: string;
      validUntil?: string | null;
      createdBy?: string;
      isGlobal?: boolean;
      bannerTitle?: string;
      bannerSubtitle?: string;
    };
    if (body.isGlobal !== undefined && typeof body.isGlobal !== "boolean") {
      reply.code(400);
      return { error: "isGlobal must be boolean" };
    }


    if (!body.code || typeof body.code !== "string") {
      reply.code(400);
      return { error: "code is required" };
    }
    if (
      body.maxUses !== undefined &&
      body.maxUses !== null &&
      (!Number.isInteger(body.maxUses) || body.maxUses <= 0)
    ) {
      reply.code(400);
      return { error: "maxUses must be a positive integer or null" };
    }

    const code = normalizeCode(body.code);
    if (!isValidCode(code)) {
      reply.code(400);
      return { error: "code must be 4-20 characters and alphanumeric" };
    }
    const parsedPercent = extractPromoPercentFromCode(code);
    if (!parsedPercent) {
      reply.code(400);
      return {
        error:
          "Promo code must end with a percentage number (e.g. WELCOME20, WELCOME15).",
      };
    }
    const validFrom = body.validFrom ? new Date(body.validFrom) : new Date();
    const validUntil = body.validUntil ? new Date(body.validUntil) : null;

    if (Number.isNaN(validFrom.getTime())) {
      reply.code(400);
      return { error: "validFrom must be a valid date" };
    }
    if (validUntil && Number.isNaN(validUntil.getTime())) {
      reply.code(400);
      return { error: "validUntil must be a valid date" };
    }
    if (validUntil && validUntil < validFrom) {
      reply.code(400);
      return { error: "validUntil must be later than validFrom" };
    }

    try {
      const created = await prisma.promoCode.create({
        data: {
          id: randomUUID(),
          code,
          discountType: "percentage",
          discountValue: parsedPercent,
          maxUses: body.maxUses ?? null,
          currentUses: 0,
          validFrom,
          validUntil,
          isActive: true,
          isGlobal: body.isGlobal === true,
          bannerTitle: typeof body.bannerTitle === "string" ? body.bannerTitle.trim() || null : null,
          bannerSubtitle: typeof body.bannerSubtitle === "string" ? body.bannerSubtitle.trim() || null : null,
          createdBy: body.createdBy || org.id,
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
          if (syncError instanceof StripeNotConfiguredError) {
            // no-op (guarded with isStripeConfigured)
          } else {
            request.log.error(syncError, "promo code stripe sync failed");
          }
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
  });

  fastify.post("/validate", { preHandler: [requirePortalUser] }, async (request) => {
    const user = request.portalUser!;
    const settings = await prisma.organizationSettings.upsert({
      where: { organizationId: user.orgId },
      update: {},
      create: { organizationId: user.orgId },
      select: { campaignsEnabled: true },
    });
    if (!settings.campaignsEnabled) {
      return { valid: false, reason: "campaigns_disabled", message: "Campaigns disabled" };
    }

    const body = (request.body || {}) as { code?: string };
    if (!body.code || typeof body.code !== "string") {
      return { valid: false, reason: "code_required" };
    }

    const now = new Date();
    const promo = await prisma.promoCode.findFirst({
      where: {
        code: normalizeCode(body.code),
        isActive: true,
        validFrom: { lte: now },
        AND: [
          { OR: [{ validUntil: null }, { validUntil: { gte: now } }] },
          {
            OR: [
              { isGlobal: true },
              {
                createdBy: user.orgId,
                isGlobal: false,
              },
              {
                createdBy: "system-abandoned-checkout",
                isGlobal: false,
              },
              {
                createdBy: "system",
                isGlobal: false,
              },
            ],
          },
        ],
      },
    });

    if (!promo) {
      return { valid: false, reason: "not_found_or_inactive" };
    }
    if (promo.maxUses !== null && promo.currentUses >= promo.maxUses) {
      return { valid: false, reason: "max_uses_reached" };
    }
    if (!promo.isGlobal && promo.createdBy !== user.orgId && promo.createdBy !== "system" && promo.createdBy !== "system-abandoned-checkout") {
      return { valid: false, reason: "not_allowed_for_org" };
    }

    return {
      valid: true,
      code: promo.code,
      isGlobal: promo.isGlobal,
      discountType: promo.discountType,
      discount: promo.discountValue,
      currentUses: promo.currentUses,
      maxUses: promo.maxUses,
    };
  });

  fastify.get<{ Params: { code: string } }>("/:code", { preHandler: [requireAdmin] }, async (request, reply) => {
    const org = await resolveAdminOrg(request, reply);
    if ("error" in org) return org;
    const code = normalizeCode(request.params.code);
    const promo = await prisma.promoCode.findFirst({
      where: {
        code,
        OR: [{ createdBy: org.id }, { isGlobal: true }],
      },
    });
    if (!promo) {
      reply.code(404);
      return { error: "Promo code not found" };
    }
    return promo;
  });

  fastify.patch<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const org = await resolveAdminOrg(request, reply);
      if ("error" in org) return org;
      const body = (request.body || {}) as {
        code?: string;
        discountType?: string;
        discountValue?: number;
        maxUses?: number | null;
        validUntil?: string | null;
        isActive?: boolean;
        isGlobal?: boolean;
        bannerTitle?: string | null;
        bannerSubtitle?: string | null;
      };

      const updates: {
        code?: string;
        discountType?: DiscountType;
        discountValue?: number;
        maxUses?: number | null;
        validUntil?: Date | null;
        isActive?: boolean;
        isGlobal?: boolean;
        bannerTitle?: string | null;
        bannerSubtitle?: string | null;
      } = {};

      if (body.code !== undefined) {
        if (typeof body.code !== "string") {
          reply.code(400);
          return { error: "code must be a string" };
        }
        const code = normalizeCode(body.code);
        if (!isValidCode(code)) {
          reply.code(400);
          return { error: "code must be 4-20 characters and alphanumeric" };
        }
        updates.code = code;
      }

      if (body.discountType !== undefined) {
        if (!isValidDiscountType(body.discountType)) {
          reply.code(400);
          return { error: "discountType must be 'percentage' or 'fixed'" };
        }
        updates.discountType = body.discountType;
      }

      if (body.discountValue !== undefined) {
        if (
          typeof body.discountValue !== "number" ||
          !Number.isFinite(body.discountValue) ||
          body.discountValue <= 0
        ) {
          reply.code(400);
          return { error: "discountValue must be a positive number" };
        }
        updates.discountValue = Math.round(body.discountValue);
      }

      if (body.maxUses !== undefined) {
        if (
          body.maxUses !== null &&
          (!Number.isInteger(body.maxUses) || body.maxUses <= 0)
        ) {
          reply.code(400);
          return { error: "maxUses must be a positive integer or null" };
        }
        updates.maxUses = body.maxUses;
      }

      if (body.validUntil !== undefined) {
        if (body.validUntil === null || body.validUntil === "") {
          updates.validUntil = null;
        } else {
          const validUntil = new Date(body.validUntil);
          if (Number.isNaN(validUntil.getTime())) {
            reply.code(400);
            return { error: "validUntil must be a valid date" };
          }
          updates.validUntil = validUntil;
        }
      }

      if (body.isActive !== undefined) {
        if (typeof body.isActive !== "boolean") {
          reply.code(400);
          return { error: "isActive must be boolean" };
        }
        updates.isActive = body.isActive;
      }
      if (body.isGlobal !== undefined) {
        if (typeof body.isGlobal !== "boolean") {
          reply.code(400);
          return { error: "isGlobal must be boolean" };
        }
        updates.isGlobal = body.isGlobal;
      }
      if (body.bannerTitle !== undefined) {
        updates.bannerTitle = typeof body.bannerTitle === "string" ? body.bannerTitle.trim() || null : null;
      }
      if (body.bannerSubtitle !== undefined) {
        updates.bannerSubtitle = typeof body.bannerSubtitle === "string" ? body.bannerSubtitle.trim() || null : null;
      }

      if (Object.keys(updates).length === 0) {
        return { ok: true, updated: false };
      }

      try {
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
        if (updates.code) {
          const parsedPercent = extractPromoPercentFromCode(updates.code);
          if (!parsedPercent) {
            reply.code(400);
            return {
              error:
                "Promo code must end with a percentage number (e.g. WELCOME20, WELCOME15).",
            };
          }
          updates.discountType = "percentage";
          updates.discountValue = parsedPercent;
        }

        const updated = await prisma.promoCode.update({
          where: { id: request.params.id },
          data: updates,
        });
        if (isStripeConfigured()) {
          try {
            const synced = await syncPromoCodeWithStripe({
              id: updated.id,
              code: updated.code,
              stripeCouponId: updated.stripeCouponId,
              stripePromotionCodeId: updated.stripePromotionCodeId,
            });
            const syncedUpdated = await prisma.promoCode.update({
              where: { id: updated.id },
              data: {
                discountType: "percentage",
                discountValue: synced.percent,
                stripeCouponId: synced.stripeCouponId,
                stripePromotionCodeId: synced.stripePromotionCodeId,
              },
            });
            return { ok: true, promoCode: syncedUpdated };
          } catch (syncError) {
            if (syncError instanceof PromoCodeInvalidError) {
              reply.code(400);
              return { error: syncError.message };
            }
            request.log.error(syncError, "promo code stripe sync failed on update");
          }
        }
        return { ok: true, promoCode: updated };
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: string }).code === "P2025"
        ) {
          reply.code(404);
          return { error: "Promo code not found" };
        }
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: string }).code === "P2002"
        ) {
          reply.code(409);
          return { error: "Promo code already exists" };
        }
        request.log.error(error, "promo code update failed");
        reply.code(500);
        return { error: "Promo code update failed" };
      }
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const org = await resolveAdminOrg(request, reply);
      if ("error" in org) return org;
      try {
        const deleted = await prisma.promoCode.deleteMany({
          where: {
            id: request.params.id,
            OR: [{ createdBy: org.id }, { isGlobal: true }],
          },
        });
        if (deleted.count === 0) {
          reply.code(404);
          return { error: "Promo code not found" };
        }
        return { ok: true };
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: string }).code === "P2025"
        ) {
          reply.code(404);
          return { error: "Promo code not found" };
        }
        request.log.error(error, "promo code delete failed");
        reply.code(500);
        return { error: "Promo code delete failed" };
      }
    }
  );
}
