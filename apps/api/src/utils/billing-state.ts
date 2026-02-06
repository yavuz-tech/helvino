import type { Organization } from "../types";

export type BillingLockReason = "free" | "active" | "grace" | "locked";

export type BillingLockStatus = {
  locked: boolean;
  reason: BillingLockReason;
  graceEndsAt: Date | null;
  billingLockedAt: Date | null;
  shouldSetBillingLockedAt: boolean;
};

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

function parseDate(value?: Date | string | null): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

export function isBillingActive(org: Organization): boolean {
  if (org.planKey === "free") return true;
  const status = org.billingStatus || org.planStatus;
  return Boolean(status && ACTIVE_STATUSES.has(status));
}

export function getBillingLockStatus(org: Organization, now = new Date()): BillingLockStatus {
  const graceEndsAt = parseDate(org.graceEndsAt);
  const billingLockedAt = parseDate(org.billingLockedAt);

  if (isBillingActive(org)) {
    return {
      locked: false,
      reason: org.planKey === "free" ? "free" : "active",
      graceEndsAt,
      billingLockedAt,
      shouldSetBillingLockedAt: false,
    };
  }

  if (graceEndsAt && graceEndsAt.getTime() > now.getTime()) {
    return {
      locked: true,
      reason: "grace",
      graceEndsAt,
      billingLockedAt,
      shouldSetBillingLockedAt: false,
    };
  }

  return {
    locked: true,
    reason: "locked",
    graceEndsAt,
    billingLockedAt,
    shouldSetBillingLockedAt: !billingLockedAt,
  };
}
