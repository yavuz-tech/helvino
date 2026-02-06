type BillingStatus =
  | "none"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete";

interface BillingInfo {
  billingEnforced?: boolean;
  billingStatus?: string | null;
  billingGraceDays?: number | null;
  currentPeriodEnd?: Date | string | null;
  lastStripeEventAt?: Date | string | null;
}

const ACTIVE_STATUSES = new Set<BillingStatus>(["active", "trialing"]);

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

export function isBillingWriteBlocked(info: BillingInfo): boolean {
  if (!info.billingEnforced) return false;

  const status = (info.billingStatus || "none") as BillingStatus;
  if (ACTIVE_STATUSES.has(status)) return false;

  const graceDays = typeof info.billingGraceDays === "number" ? info.billingGraceDays : 7;
  const graceStart =
    toDate(info.currentPeriodEnd) ||
    toDate(info.lastStripeEventAt);

  if (!graceStart) {
    return true;
  }

  const graceMs = graceDays * 24 * 60 * 60 * 1000;
  const graceEnd = new Date(graceStart.getTime() + graceMs);
  return new Date() > graceEnd;
}
